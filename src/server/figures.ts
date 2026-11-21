import { sql } from "drizzle-orm";
import { paymentState, today, type PaymentState } from "@/lib/totals";

/** What has been paid against an invoice, as a column of a select. */
// Written out in full: drizzle leaves table names off columns in a query on
// one table, which would turn these correlated subqueries into self-joins.
export const paidColumn = sql<number>`coalesce((select sum(p.amount) from payments p where p.invoice_id = "invoices"."id"), 0)`;

/** What credit notes have taken off an invoice. */
export const creditedColumn = sql<number>`coalesce((select sum(c.total) from credit_notes c where c.invoice_id = "invoices"."id"), 0)`;

export type InvoiceState = "draft" | "void" | PaymentState;

/** Draft, void, or how far an issued invoice has been paid. */
export function invoiceState(invoice: {
  status: "draft" | "issued" | "void";
  total: number;
  paid: number;
  credited: number;
  dueDate: string;
}): InvoiceState {
  if (invoice.status !== "issued") return invoice.status;
  return paymentState({ ...invoice, today: today() });
}

export function balanceOf(invoice: {
  status: string;
  total: number;
  paid: number;
  credited: number;
}): number {
  return invoice.status === "issued"
    ? invoice.total - invoice.paid - invoice.credited
    : 0;
}
