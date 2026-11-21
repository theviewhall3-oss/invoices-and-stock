import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  invoiceLines,
  invoices,
  quoteLines,
  quotes,
  settings,
} from "@/db/schema";
import { addDays, today } from "@/lib/totals";
import { fail, newId, newToken, ownedBy, type Actor } from "./actor";
import { prepareDocument, type DocumentInput } from "./documents";
import { getSettings } from "./settings";

type QuoteStatus = (typeof quotes.$inferSelect)["status"];

export async function listQuotes(
  actor: Actor,
  filters: { status?: QuoteStatus; clientId?: string } = {},
) {
  return db
    .select({
      id: quotes.id,
      number: quotes.number,
      status: quotes.status,
      issueDate: quotes.issueDate,
      expiryDate: quotes.expiryDate,
      total: quotes.total,
      clientId: quotes.clientId,
      clientName: clients.name,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(
      and(
        ownedBy(actor, quotes.ownerId),
        filters.status ? eq(quotes.status, filters.status) : undefined,
        filters.clientId ? eq(quotes.clientId, filters.clientId) : undefined,
      ),
    )
    .orderBy(desc(quotes.number));
}

async function findQuote(actor: Actor, id: string) {
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), ownedBy(actor, quotes.ownerId)));
  return quote ?? null;
}

export async function getQuote(actor: Actor, id: string) {
  const quote = await findQuote(actor, id);
  if (!quote) return null;
  const [lines, [client]] = await Promise.all([
    db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id))
      .orderBy(asc(quoteLines.position)),
    db.select().from(clients).where(eq(clients.id, quote.clientId)),
  ]);
  return { quote, lines, client: client! };
}

export async function createQuote(actor: Actor, input: DocumentInput) {
  const { totals, lines } = await prepareDocument(actor, input);
  await getSettings();
  const id = newId();
  await db.batch([
    db.insert(quotes).values({
      id,
      ownerId: actor.id,
      clientId: input.clientId,
      number: sql`(select ${settings.nextQuoteNumber} from ${settings} where ${settings.id} = 1)`,
      status: "draft",
      issueDate: input.issueDate,
      expiryDate: input.endDate,
      discountRate: input.discountRate,
      notes: input.notes,
      ...totals,
    }),
    db
      .update(settings)
      .set({ nextQuoteNumber: sql`${settings.nextQuoteNumber} + 1` })
      .where(eq(settings.id, 1)),
    db.insert(quoteLines).values(lines.map((line) => ({ ...line, quoteId: id }))),
  ]);
  return { id };
}

export async function updateQuote(
  actor: Actor,
  id: string,
  input: DocumentInput,
) {
  const quote = await findQuote(actor, id);
  if (!quote) fail("No such quote.");
  if (quote.status !== "draft") fail("Only a draft quote can be changed.");
  const { totals, lines } = await prepareDocument(actor, input);
  await db.batch([
    db
      .update(quotes)
      .set({
        clientId: input.clientId,
        issueDate: input.issueDate,
        expiryDate: input.endDate,
        discountRate: input.discountRate,
        notes: input.notes,
        ...totals,
      })
      .where(and(eq(quotes.id, id), eq(quotes.status, "draft"))),
    db.delete(quoteLines).where(eq(quoteLines.quoteId, id)),
    db.insert(quoteLines).values(lines.map((line) => ({ ...line, quoteId: id }))),
  ]);
  return { id };
}

export async function deleteQuote(actor: Actor, id: string) {
  const quote = await findQuote(actor, id);
  if (!quote) fail("No such quote.");
  if (quote.status !== "draft") fail("Only a draft quote can be deleted.");
  await db.batch([
    db.delete(quoteLines).where(eq(quoteLines.quoteId, id)),
    db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.status, "draft"))),
  ]);
}

/** Marks a draft sent and gives it the link the client opens. */
export async function markQuoteSent(actor: Actor, id: string) {
  const quote = await findQuote(actor, id);
  if (!quote) fail("No such quote.");
  if (quote.status !== "draft") fail("This quote has already been sent.");
  await db
    .update(quotes)
    .set({ status: "sent", shareToken: quote.shareToken ?? newToken() })
    .where(and(eq(quotes.id, id), eq(quotes.status, "draft")));
}

/** Turns a sent or accepted quote into a draft invoice, once. */
export async function convertQuote(actor: Actor, id: string) {
  const found = await getQuote(actor, id);
  if (!found) fail("No such quote.");
  const { quote, lines } = found;
  if (quote.status === "invoiced") fail("This quote is already invoiced.");
  if (quote.status !== "sent" && quote.status !== "accepted")
    fail("Only a sent or accepted quote can become an invoice.");
  const business = await getSettings();
  const invoiceId = newId();
  const issueDate = today();
  await db.batch([
    db.insert(invoices).values({
      id: invoiceId,
      ownerId: actor.id,
      clientId: quote.clientId,
      quoteId: quote.id,
      status: "draft",
      issueDate,
      dueDate: addDays(issueDate, business.paymentTermsDays),
      discountRate: quote.discountRate,
      notes: quote.notes,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
    }),
    db.insert(invoiceLines).values(
      lines.map((line) => ({
        id: newId(),
        invoiceId,
        position: line.position,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountRate: line.discountRate,
        taxRate: line.taxRate,
      })),
    ),
    db
      .update(quotes)
      .set({ status: "invoiced", invoiceId })
      .where(
        and(
          eq(quotes.id, id),
          inArray(quotes.status, ["sent", "accepted"]),
          sql`${quotes.invoiceId} is null`,
        ),
      ),
  ]);
  return { invoiceId };
}

// The share link: anyone holding the token, signed in or not.

export async function quoteByToken(token: string) {
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.shareToken, token));
  if (!quote) return null;
  const [lines, [client], business] = await Promise.all([
    db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quote.id))
      .orderBy(asc(quoteLines.position)),
    db.select().from(clients).where(eq(clients.id, quote.clientId)),
    getSettings(),
  ]);
  return {
    quote: {
      number: quote.number,
      status: quote.status,
      issueDate: quote.issueDate,
      expiryDate: quote.expiryDate,
      discountRate: quote.discountRate,
      notes: quote.notes,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      expired: quote.expiryDate < today(),
    },
    lines: lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      taxRate: line.taxRate,
    })),
    client: { name: client?.name ?? "", company: client?.company ?? "" },
    business: {
      name: business.businessName,
      address: business.address,
      currencyCode: business.currencyCode,
    },
  };
}

type RespondResult = "accepted" | "declined" | "not_found" | "closed" | "expired";

/** The client's answer: accepted or declined once, while the quote is open. */
export async function respondToQuote(
  token: string,
  answer: "accept" | "decline",
): Promise<RespondResult> {
  const status = answer === "accept" ? "accepted" : "declined";
  const [changed] = await db
    .update(quotes)
    .set({ status, respondedAt: sql`(current_timestamp)` })
    .where(
      and(
        eq(quotes.shareToken, token),
        eq(quotes.status, "sent"),
        sql`${quotes.expiryDate} >= ${today()}`,
      ),
    )
    .returning({ id: quotes.id });
  if (changed) return status;
  const [quote] = await db
    .select({ status: quotes.status, expiryDate: quotes.expiryDate })
    .from(quotes)
    .where(eq(quotes.shareToken, token));
  if (!quote) return "not_found";
  if (quote.status === "sent") return "expired";
  return "closed";
}
