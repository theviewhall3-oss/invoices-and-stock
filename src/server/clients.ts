import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, invoices, payments, quoteLines, quotes } from "@/db/schema";
import { fail, newId, ownedBy, type Actor } from "./actor";
import {
  balanceOf,
  creditedColumn,
  invoiceState,
  paidColumn,
} from "./figures";

export const clientInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  company: z.string().trim().max(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  phone: z.string().trim().max(50).default(""),
  address: z.string().trim().max(1000).default(""),
  taxId: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(5000).default(""),
});

type Client = typeof clients.$inferSelect;

/** One client the actor may see, or null. */
export async function findClient(
  actor: Actor,
  id: string,
): Promise<Client | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), ownedBy(actor, clients.ownerId)));
  return client ?? null;
}

export async function listClients(actor: Actor, search = "") {
  const term = search.trim();
  const pattern = `%${term}%`;
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      company: clients.company,
      email: clients.email,
      phone: clients.phone,
      balance: sql<number>`coalesce((select sum(i.total
        - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)
        - coalesce((select sum(c.total) from credit_notes c where c.invoice_id = i.id), 0))
        from invoices i where i.client_id = "clients"."id" and i.status = 'issued'), 0)`,
    })
    .from(clients)
    .where(
      and(
        ownedBy(actor, clients.ownerId),
        term
          ? or(
              like(clients.name, pattern),
              like(clients.company, pattern),
              like(clients.email, pattern),
              like(clients.phone, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(clients.name);
  return rows;
}

export async function getClientDetail(actor: Actor, id: string) {
  const client = await findClient(actor, id);
  if (!client) return null;
  const [clientQuotes, clientInvoices, clientPayments] = await Promise.all([
    db
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        issueDate: quotes.issueDate,
        total: quotes.total,
      })
      .from(quotes)
      .where(and(eq(quotes.clientId, id), ownedBy(actor, quotes.ownerId)))
      .orderBy(desc(quotes.number)),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        paid: paidColumn,
        credited: creditedColumn,
      })
      .from(invoices)
      .where(and(eq(invoices.clientId, id), ownedBy(actor, invoices.ownerId)))
      .orderBy(desc(invoices.issueDate), desc(invoices.createdAt)),
    db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.number,
        amount: payments.amount,
        date: payments.date,
        method: payments.method,
        reference: payments.reference,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(and(eq(invoices.clientId, id), ownedBy(actor, invoices.ownerId)))
      .orderBy(desc(payments.date)),
  ]);
  const shownInvoices = clientInvoices.map((invoice) => ({
    ...invoice,
    state: invoiceState(invoice),
    balance: balanceOf(invoice),
  }));
  return {
    client,
    quotes: clientQuotes,
    invoices: shownInvoices,
    payments: clientPayments,
    balance: shownInvoices.reduce((sum, invoice) => sum + invoice.balance, 0),
  };
}

export async function createClient(
  actor: Actor,
  input: z.infer<typeof clientInput>,
): Promise<Client> {
  const [client] = await db
    .insert(clients)
    .values({ id: newId(), ownerId: actor.id, ...input })
    .returning();
  return client!;
}

export async function updateClient(
  actor: Actor,
  id: string,
  input: z.infer<typeof clientInput>,
): Promise<Client> {
  const [client] = await db
    .update(clients)
    .set(input)
    .where(and(eq(clients.id, id), ownedBy(actor, clients.ownerId)))
    .returning();
  return client ?? fail("No such client.");
}

export async function deleteClient(actor: Actor, id: string): Promise<void> {
  const client = await findClient(actor, id);
  if (!client) fail("No such client.");
  const [used] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .limit(1);
  if (used) fail("This client has invoices, so it can't be deleted.");
  const clientQuotes = db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.clientId, id));
  await db.batch([
    db.delete(quoteLines).where(sql`${quoteLines.quoteId} in ${clientQuotes}`),
    db.delete(quotes).where(eq(quotes.clientId, id)),
    db
      .delete(clients)
      .where(
        and(
          eq(clients.id, id),
          sql`not exists (select 1 from ${invoices} where ${invoices.clientId} = ${id})`,
        ),
      ),
  ]);
}
