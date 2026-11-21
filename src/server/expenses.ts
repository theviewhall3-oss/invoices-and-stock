import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenses, suppliers } from "@/db/schema";
import { fail, newId, ownedBy, type Actor } from "./actor";

export const expenseInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1, "Category is required").max(100),
  amount: z.number().int().positive("Enter an amount above zero"),
  supplierId: z.string().nullable(),
  note: z.string().trim().max(1000).default(""),
});

export async function listExpenses(actor: Actor, month?: string) {
  const rows = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      category: expenses.category,
      amount: expenses.amount,
      note: expenses.note,
      supplierId: expenses.supplierId,
      supplierName: suppliers.name,
    })
    .from(expenses)
    .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
    .where(
      and(
        ownedBy(actor, expenses.ownerId),
        month ? like(expenses.date, `${month}%`) : undefined,
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  const byCategory = new Map<string, number>();
  for (const row of rows)
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  return {
    expenses: rows,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    byCategory: [...byCategory]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
  };
}

async function checkSupplier(supplierId: string | null) {
  if (!supplierId) return;
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId));
  if (!supplier) fail("No such supplier.");
}

export async function createExpense(
  actor: Actor,
  input: z.infer<typeof expenseInput>,
) {
  await checkSupplier(input.supplierId);
  const [row] = await db
    .insert(expenses)
    .values({ id: newId(), ownerId: actor.id, ...input })
    .returning({ id: expenses.id });
  return row!;
}

export async function updateExpense(
  actor: Actor,
  id: string,
  input: z.infer<typeof expenseInput>,
) {
  await checkSupplier(input.supplierId);
  const [row] = await db
    .update(expenses)
    .set(input)
    .where(and(eq(expenses.id, id), ownedBy(actor, expenses.ownerId)))
    .returning({ id: expenses.id });
  return row ?? fail("No such expense.");
}

export async function deleteExpense(actor: Actor, id: string) {
  const [row] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), ownedBy(actor, expenses.ownerId)))
    .returning({ id: expenses.id });
  if (!row) fail("No such expense.");
}
