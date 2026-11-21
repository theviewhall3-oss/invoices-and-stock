import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { batch } from "@/db/raw";
import {
  clients,
  creditNoteLines,
  creditNotes,
  invoiceLines,
  invoices,
  payments,
  products,
  quotes,
  stockMovements,
} from "@/db/schema";
import { creditFor } from "@/lib/totals";
import { fail, newId, newToken, ownedBy, requireAdmin, type Actor } from "./actor";
import { prepareDocument, type DocumentInput } from "./documents";
import {
  balanceOf,
  creditedColumn,
  invoiceState,
  paidColumn,
  type InvoiceState,
} from "./figures";
import { getSettings } from "./settings";

export const invoiceFilters = z.object({
  state: z
    .enum(["draft", "void", "unpaid", "partially_paid", "paid", "overdue"])
    .optional(),
  clientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const creditNoteInput = z.object({
  invoiceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(1000).default(""),
  lines: z.array(
    z.object({ invoiceLineId: z.string(), quantity: z.number().min(0) }),
  ),
});

const listColumns = {
  id: invoices.id,
  number: invoices.number,
  status: invoices.status,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  total: invoices.total,
  clientId: invoices.clientId,
  clientName: clients.name,
  paid: paidColumn,
  credited: creditedColumn,
};

export async function listInvoices(
  actor: Actor,
  filters: z.infer<typeof invoiceFilters> = {},
) {
  const rows = await db
    .select(listColumns)
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        ownedBy(actor, invoices.ownerId),
        filters.clientId ? eq(invoices.clientId, filters.clientId) : undefined,
        filters.from ? gte(invoices.issueDate, filters.from) : undefined,
        filters.to ? lte(invoices.issueDate, filters.to) : undefined,
      ),
    )
    .orderBy(desc(invoices.issueDate), desc(invoices.number));
  return rows
    .map((row) => ({ ...row, state: invoiceState(row), balance: balanceOf(row) }))
    .filter((row) => !filters.state || row.state === filters.state);
}

async function findInvoice(actor: Actor, id: string) {
  const [invoice] = await db
    .select({ ...listColumns, ownerId: invoices.ownerId })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, id), ownedBy(actor, invoices.ownerId)));
  return invoice ?? null;
}

export async function getInvoice(actor: Actor, id: string) {
  const [invoice] = await db
    .select({ invoice: invoices, paid: paidColumn, credited: creditedColumn })
    .from(invoices)
    .where(and(eq(invoices.id, id), ownedBy(actor, invoices.ownerId)));
  if (!invoice) return null;
  return detail(invoice);
}

async function detail(row: {
  invoice: typeof invoices.$inferSelect;
  paid: number;
  credited: number;
}) {
  const { invoice } = row;
  const [lines, [client], invoicePayments, notes, returned, [quote]] =
    await Promise.all([
      db
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, invoice.id))
        .orderBy(asc(invoiceLines.position)),
      db.select().from(clients).where(eq(clients.id, invoice.clientId)),
      db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoice.id))
        .orderBy(desc(payments.date), desc(payments.createdAt)),
      db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.invoiceId, invoice.id))
        .orderBy(asc(creditNotes.createdAt)),
      db
        .select({
          invoiceLineId: creditNoteLines.invoiceLineId,
          quantity: sql<number>`sum(${creditNoteLines.quantity})`,
        })
        .from(creditNoteLines)
        .innerJoin(creditNotes, eq(creditNotes.id, creditNoteLines.creditNoteId))
        .where(eq(creditNotes.invoiceId, invoice.id))
        .groupBy(creditNoteLines.invoiceLineId),
      invoice.quoteId
        ? db
            .select({ id: quotes.id, number: quotes.number })
            .from(quotes)
            .where(eq(quotes.id, invoice.quoteId))
        : Promise.resolve([]),
    ]);
  const returnedBy = new Map(returned.map((r) => [r.invoiceLineId, r.quantity]));
  const figures = { ...invoice, paid: row.paid, credited: row.credited };
  return {
    invoice,
    client: client!,
    quote: quote ?? null,
    lines: lines.map((line) => ({
      ...line,
      returned: returnedBy.get(line.id) ?? 0,
    })),
    payments: invoicePayments,
    creditNotes: notes,
    paid: row.paid,
    credited: row.credited,
    balance: balanceOf(figures),
    state: invoiceState(figures) as InvoiceState,
  };
}

export async function createInvoice(actor: Actor, input: DocumentInput) {
  const { totals, lines } = await prepareDocument(actor, input);
  const id = newId();
  await db.batch([
    db.insert(invoices).values({
      id,
      ownerId: actor.id,
      clientId: input.clientId,
      status: "draft",
      issueDate: input.issueDate,
      dueDate: input.endDate,
      discountRate: input.discountRate,
      notes: input.notes,
      ...totals,
    }),
    db
      .insert(invoiceLines)
      .values(lines.map((line) => ({ ...line, invoiceId: id }))),
  ]);
  return { id };
}

export async function updateInvoice(
  actor: Actor,
  id: string,
  input: DocumentInput,
) {
  const invoice = await findInvoice(actor, id);
  if (!invoice) fail("No such invoice.");
  if (invoice.status !== "draft") fail("Only a draft invoice can be changed.");
  const { totals, lines } = await prepareDocument(actor, input);
  await db.batch([
    db
      .update(invoices)
      .set({
        clientId: input.clientId,
        issueDate: input.issueDate,
        dueDate: input.endDate,
        discountRate: input.discountRate,
        notes: input.notes,
        ...totals,
      })
      .where(and(eq(invoices.id, id), eq(invoices.status, "draft"))),
    db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id)),
    db
      .insert(invoiceLines)
      .values(lines.map((line) => ({ ...line, invoiceId: id }))),
  ]);
  return { id };
}

export async function deleteInvoice(actor: Actor, id: string) {
  const invoice = await findInvoice(actor, id);
  if (!invoice) fail("No such invoice.");
  if (invoice.status !== "draft") fail("Only a draft invoice can be deleted.");
  await db.batch([
    db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id)),
    db
      .update(quotes)
      .set({ status: "accepted", invoiceId: null })
      .where(eq(quotes.invoiceId, id)),
    db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.status, "draft"))),
  ]);
}

/**
 * Gives a draft the next number, locks it, takes tracked products out of
 * stock and creates its share link: all in one batch, which D1 runs as a
 * transaction. The fresh token guards the later statements, so a second
 * issue of the same invoice changes nothing.
 */
export async function issueInvoice(actor: Actor, id: string) {
  const invoice = await findInvoice(actor, id);
  if (!invoice) fail("No such invoice.");
  if (invoice.status !== "draft") fail("This invoice has already been issued.");
  await getSettings();
  const token = newToken();
  const issued =
    "exists (select 1 from invoices where id = ? and share_token = ?)";
  try {
    await batch([
      [
        `update invoices set status = 'issued', share_token = ?,
          number = (select next_invoice_number from settings where id = 1)
          where id = ? and status = 'draft'`,
        token,
        id,
      ],
      [
        `update settings set next_invoice_number = next_invoice_number + 1
          where id = 1 and ${issued}`,
        id,
        token,
      ],
      [
        `insert into stock_movements (id, product_id, quantity, kind, ref_id, reason, user_id)
          select lower(hex(randomblob(16))), l.product_id, -l.quantity, 'sale', ?, '', ?
          from invoice_lines l join products p on p.id = l.product_id
          where l.invoice_id = ? and p.track_stock = 1 and ${issued}`,
        id,
        actor.id,
        id,
        id,
        token,
      ],
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      fail("That invoice number is taken. Raise the next invoice number in Settings.");
    throw error;
  }
}

/** An admin voids an issued invoice with no payments; its stock comes back. */
export async function voidInvoice(actor: Actor, id: string) {
  requireAdmin(actor);
  const invoice = await findInvoice(actor, id);
  if (!invoice) fail("No such invoice.");
  if (invoice.status !== "issued") fail("Only an issued invoice can be voided.");
  if (invoice.paid > 0) fail("Delete this invoice's payments before voiding it.");
  await batch([
    [
      `update invoices set status = 'void'
        where id = ? and status = 'issued'
        and not exists (select 1 from payments where invoice_id = ?)`,
      id,
      id,
    ],
    [
      `insert into stock_movements (id, product_id, quantity, kind, ref_id, reason, user_id)
        select lower(hex(randomblob(16))), product_id, -sum(quantity), 'void', ?, '', ?
        from stock_movements
        where ((ref_id = ? and kind = 'sale')
            or (kind = 'credit' and ref_id in (select id from credit_notes where invoice_id = ?)))
          and exists (select 1 from invoices where id = ? and status = 'void')
          and not exists (select 1 from stock_movements where ref_id = ? and kind = 'void')
        group by product_id having sum(quantity) != 0`,
      id,
      actor.id,
      id,
      id,
      id,
      id,
    ],
  ]);
}

/** Returns some or all of an issued invoice's lines: less to pay, stock back. */
export async function createCreditNote(
  actor: Actor,
  input: z.infer<typeof creditNoteInput>,
) {
  const found = await getInvoice(actor, input.invoiceId);
  if (!found) fail("No such invoice.");
  const { invoice, lines } = found;
  if (invoice.status !== "issued")
    fail("Only an issued invoice can be credited.");
  const wanted = input.lines.filter((line) => line.quantity > 0);
  if (!wanted.length) fail("Enter a quantity to return on at least one line.");
  const byId = new Map(lines.map((line) => [line.id, line]));
  let subtotal = 0;
  let taxTotal = 0;
  for (const want of wanted) {
    const line = byId.get(want.invoiceLineId);
    if (!line) fail("A returned line isn't on this invoice.");
    if (want.quantity > line.quantity - line.returned + 1e-9)
      fail(`Only ${line.quantity - line.returned} of "${line.description}" can be returned.`);
    const credit = creditFor(line, invoice.discountRate, want.quantity);
    subtotal += credit.net;
    taxTotal += credit.tax;
  }
  const noteId = newId();
  const productIds = wanted
    .map((want) => byId.get(want.invoiceLineId)!.productId)
    .filter((id): id is string => Boolean(id));
  const tracked = new Set(
    productIds.length
      ? (
          await db
            .select({ id: products.id })
            .from(products)
            .where(and(inArray(products.id, productIds), eq(products.trackStock, true)))
        ).map((row) => row.id)
      : [],
  );
  const movements = wanted.flatMap((want) => {
    const productId = byId.get(want.invoiceLineId)!.productId;
    return productId && tracked.has(productId)
      ? [
          {
            id: newId(),
            productId,
            quantity: want.quantity,
            kind: "credit" as const,
            refId: noteId,
            reason: input.reason,
            userId: actor.id,
          },
        ]
      : [];
  });
  await db.batch([
    db.insert(creditNotes).values({
      id: noteId,
      invoiceId: invoice.id,
      ownerId: actor.id,
      date: input.date,
      reason: input.reason,
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
    }),
    db.insert(creditNoteLines).values(
      wanted.map((want) => ({
        id: newId(),
        creditNoteId: noteId,
        invoiceLineId: want.invoiceLineId,
        quantity: want.quantity,
      })),
    ),
    ...(movements.length ? [db.insert(stockMovements).values(movements)] : []),
  ]);
  return { id: noteId };
}

// The share link.

export async function invoiceByToken(token: string) {
  const [row] = await db
    .select({ invoice: invoices, paid: paidColumn, credited: creditedColumn })
    .from(invoices)
    .where(eq(invoices.shareToken, token));
  if (!row) return null;
  const found = await detail(row);
  const business = await getSettings();
  const { invoice } = found;
  return {
    invoice: {
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      discountRate: invoice.discountRate,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
    },
    lines: found.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      taxRate: line.taxRate,
    })),
    paid: found.paid,
    credited: found.credited,
    balance: found.balance,
    state: found.state,
    client: { name: found.client.name, company: found.client.company },
    business: {
      name: business.businessName,
      address: business.address,
      currencyCode: business.currencyCode,
    },
  };
}

