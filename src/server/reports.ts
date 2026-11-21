import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  creditNotes,
  expenses,
  invoices,
  purchaseBills,
} from "@/db/schema";
import { daysBetween, today } from "@/lib/totals";
import { ownedBy, type Actor } from "./actor";
import { creditedColumn, paidColumn } from "./figures";
import { listInvoices } from "./invoices";
import { lowStock } from "./products";

export async function dashboard(actor: Actor) {
  const now = today();
  const month = now.slice(0, 7);
  const [issued, low] = await Promise.all([
    listInvoices(actor),
    lowStock(),
  ]);
  const open = issued.filter((invoice) => invoice.status === "issued");
  const overdue = open.filter((invoice) => invoice.state === "overdue");
  return {
    salesThisMonth: open
      .filter((invoice) => invoice.issueDate.startsWith(month))
      .reduce((sum, invoice) => sum + invoice.total, 0),
    outstanding: open.reduce((sum, invoice) => sum + Math.max(invoice.balance, 0), 0),
    overdue: overdue.slice(0, 10),
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((sum, invoice) => sum + invoice.balance, 0),
    lowStock: low,
  };
}

/** Issued invoices and credits per month, for the last twelve months. */
export async function salesByMonth(actor: Actor) {
  const months: string[] = [];
  const day = new Date(`${today().slice(0, 7)}-01T00:00:00Z`);
  for (let i = 11; i >= 0; i--) {
    const at = new Date(day);
    at.setUTCMonth(at.getUTCMonth() - i);
    months.push(at.toISOString().slice(0, 7));
  }
  const first = `${months[0]}-01`;
  const [sales, credits] = await Promise.all([
    db
      .select({
        month: sql<string>`substr(${invoices.issueDate}, 1, 7)`,
        total: sql<number>`sum(${invoices.total})`,
        count: sql<number>`count(*)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "issued"),
          gte(invoices.issueDate, first),
          ownedBy(actor, invoices.ownerId),
        ),
      )
      .groupBy(sql`substr(${invoices.issueDate}, 1, 7)`),
    db
      .select({
        month: sql<string>`substr(${creditNotes.date}, 1, 7)`,
        total: sql<number>`sum(${creditNotes.total})`,
      })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .where(
        and(
          eq(invoices.status, "issued"),
          gte(creditNotes.date, first),
          ownedBy(actor, invoices.ownerId),
        ),
      )
      .groupBy(sql`substr(${creditNotes.date}, 1, 7)`),
  ]);
  return months.map((month) => {
    const sale = sales.find((row) => row.month === month);
    const credit = credits.find((row) => row.month === month);
    const invoiced = sale?.total ?? 0;
    const credited = credit?.total ?? 0;
    return { month, count: sale?.count ?? 0, invoiced, credited, net: invoiced - credited };
  });
}

const BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

/** What each client still owes, by how many days past due. */
export async function receivablesAging(actor: Actor) {
  const now = today();
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      dueDate: invoices.dueDate,
      balance: sql<number>`${invoices.total} - ${paidColumn} - ${creditedColumn}`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.status, "issued"), ownedBy(actor, invoices.ownerId)));
  const byClient = new Map<
    string,
    { clientId: string; clientName: string; buckets: number[]; total: number }
  >();
  for (const row of rows) {
    if (row.balance <= 0) continue;
    const late = Math.max(daysBetween(row.dueDate, now), 0);
    const bucket = late <= 30 ? 0 : late <= 60 ? 1 : late <= 90 ? 2 : 3;
    const entry =
      byClient.get(row.clientId) ??
      { clientId: row.clientId, clientName: row.clientName, buckets: [0, 0, 0, 0], total: 0 };
    entry.buckets[bucket]! += row.balance;
    entry.total += row.balance;
    byClient.set(row.clientId, entry);
  }
  const clientsAging = [...byClient.values()].sort((a, b) => b.total - a.total);
  return {
    buckets: BUCKETS,
    clients: clientsAging,
    totals: BUCKETS.map((_, i) =>
      clientsAging.reduce((sum, entry) => sum + entry.buckets[i]!, 0),
    ),
  };
}

/** Profit before tax: invoiced sales less credits, purchases and expenses. */
export async function profit(actor: Actor, from: string, to: string) {
  const [[sales], [credits], [purchases], [spent]] = await Promise.all([
    db
      .select({ value: sql<number>`coalesce(sum(${invoices.subtotal} - ${invoices.discountTotal}), 0)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "issued"),
          gte(invoices.issueDate, from),
          lte(invoices.issueDate, to),
          ownedBy(actor, invoices.ownerId),
        ),
      ),
    db
      .select({ value: sql<number>`coalesce(sum(${creditNotes.subtotal}), 0)` })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .where(
        and(
          eq(invoices.status, "issued"),
          gte(creditNotes.date, from),
          lte(creditNotes.date, to),
          ownedBy(actor, invoices.ownerId),
        ),
      ),
    db
      .select({ value: sql<number>`coalesce(sum(${purchaseBills.subtotal}), 0)` })
      .from(purchaseBills)
      .where(
        and(
          eq(purchaseBills.status, "received"),
          gte(purchaseBills.billDate, from),
          lte(purchaseBills.billDate, to),
          ownedBy(actor, purchaseBills.ownerId),
        ),
      ),
    db
      .select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(
        and(
          gte(expenses.date, from),
          lte(expenses.date, to),
          ownedBy(actor, expenses.ownerId),
        ),
      ),
  ]);
  const result = {
    sales: sales?.value ?? 0,
    credits: credits?.value ?? 0,
    purchases: purchases?.value ?? 0,
    expenses: spent?.value ?? 0,
  };
  return {
    ...result,
    profit: result.sales - result.credits - result.purchases - result.expenses,
  };
}
