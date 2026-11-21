import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenses, purchaseBills, suppliers } from "@/db/schema";
import { fail, newId, requireAdmin, type Actor } from "./actor";

export const supplierInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contact: z.string().trim().max(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  phone: z.string().trim().max(50).default(""),
  address: z.string().trim().max(1000).default(""),
});

export function listSuppliers() {
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function createSupplier(
  actor: Actor,
  input: z.infer<typeof supplierInput>,
) {
  requireAdmin(actor);
  const [row] = await db
    .insert(suppliers)
    .values({ id: newId(), ...input })
    .returning({ id: suppliers.id });
  return row!;
}

export async function updateSupplier(
  actor: Actor,
  id: string,
  input: z.infer<typeof supplierInput>,
) {
  requireAdmin(actor);
  const [row] = await db
    .update(suppliers)
    .set(input)
    .where(eq(suppliers.id, id))
    .returning({ id: suppliers.id });
  return row ?? fail("No such supplier.");
}

export async function deleteSupplier(actor: Actor, id: string) {
  requireAdmin(actor);
  const [[bill], [expense]] = await Promise.all([
    db.select({ id: purchaseBills.id }).from(purchaseBills).where(eq(purchaseBills.supplierId, id)).limit(1),
    db.select({ id: expenses.id }).from(expenses).where(eq(expenses.supplierId, id)).limit(1),
  ]);
  if (bill || expense)
    fail("This supplier has bills or expenses, so it can't be deleted.");
  await db.delete(suppliers).where(eq(suppliers.id, id));
}
