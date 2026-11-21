import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, creditNotes, invoices, payments } from "@/db/schema";
import { fail, newId, ownedBy, type Actor } from "./actor";

const methods = ["cash", "bank_transfer", "card", "cheque", "other"] as const;

export const paymentInput = z.object({
  invoiceId: z.string(),
  amount: z.number().int().positive("Enter an amount above zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(methods),
  reference: z.string().trim().max(200).default(""),
});

export const paymentFilters = z.object({
  method: z.enum(methods).optional(),
  clientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function listPayments(
  actor: Actor,
  filters: z.infer<typeof paymentFilters> = {},
) {
  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      date: payments.date,
      method: payments.method,
      reference: payments.reference,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        ownedBy(actor, invoices.ownerId),
        filters.method ? eq(payments.method, filters.method) : undefined,
        filters.clientId ? eq(invoices.clientId, filters.clientId) : undefined,
        filters.from ? gte(payments.date, filters.from) : undefined,
        filters.to ? lte(payments.date, filters.to) : undefined,
      ),
    )
    .orderBy(desc(payments.date), desc(payments.createdAt));
}

/**
 * Records a payment in one statement that only inserts while the invoice is
 * issued and the amount fits what is left to pay, so two payments at once
 * can't overpay it.
 */
export async function recordPayment(
  actor: Actor,
  input: z.infer<typeof paymentInput>,
) {
  const [invoice] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), ownedBy(actor, invoices.ownerId)));
  if (!invoice) fail("No such invoice.");
  if (invoice.status !== "issued")
    fail("Payments can only be recorded on an issued invoice.");
  const id = newId();
  const remaining = sql`(select i.total
      - coalesce((select sum(p.amount) from ${payments} p where p.invoice_id = i.id), 0)
      - coalesce((select sum(c.total) from ${creditNotes} c where c.invoice_id = i.id), 0)
    from ${invoices} i where i.id = ${input.invoiceId} and i.status = 'issued')`;
  const result = await db.run(sql`insert into ${payments} (id, invoice_id, owner_id, amount, date, method, reference)
    select ${id}, ${input.invoiceId}, ${actor.id}, ${input.amount}, ${input.date}, ${input.method}, ${input.reference}
    where ${input.amount} <= ${remaining}`);
  if (!changes(result))
    fail("That is more than the balance left on this invoice.");
  return { id };
}

function changes(result: unknown): number {
  const meta = (result as { meta?: { changes?: number }; rowsAffected?: number });
  return meta.meta?.changes ?? meta.rowsAffected ?? 0;
}

export async function deletePayment(actor: Actor, id: string) {
  const [payment] = await db
    .select({ id: payments.id })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(payments.id, id), ownedBy(actor, invoices.ownerId)));
  if (!payment) fail("No such payment.");
  await db.delete(payments).where(eq(payments.id, id));
}
