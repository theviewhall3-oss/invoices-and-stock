import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { batch } from "@/db/raw";
import {
  products,
  purchaseBills,
  purchaseLines,
  suppliers,
} from "@/db/schema";
import { documentTotals } from "@/lib/totals";
import { fail, newId, ownedBy, type Actor } from "./actor";

export const billInput = z.object({
  supplierId: z.string().min(1, "Pick a supplier"),
  reference: z.string().trim().max(200).default(""),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(5000).default(""),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "Pick an item on each line"),
        quantity: z.number().positive("Quantities must be above zero"),
        unitCost: z.number().int().min(0),
        taxRate: z.number().min(0).max(100),
      }),
    )
    .min(1, "Add at least one line")
    .max(200),
});

export async function listBills(actor: Actor, month?: string) {
  const rows = await db
    .select({
      id: purchaseBills.id,
      reference: purchaseBills.reference,
      billDate: purchaseBills.billDate,
      status: purchaseBills.status,
      total: purchaseBills.total,
      supplierName: suppliers.name,
    })
    .from(purchaseBills)
    .innerJoin(suppliers, eq(suppliers.id, purchaseBills.supplierId))
    .where(
      and(
        ownedBy(actor, purchaseBills.ownerId),
        month ? like(purchaseBills.billDate, `${month}%`) : undefined,
      ),
    )
    .orderBy(desc(purchaseBills.billDate), desc(purchaseBills.createdAt));
  const bySupplier = new Map<string, number>();
  for (const row of rows)
    bySupplier.set(row.supplierName, (bySupplier.get(row.supplierName) ?? 0) + row.total);
  return {
    bills: rows,
    total: rows.reduce((sum, row) => sum + row.total, 0),
    bySupplier: [...bySupplier].map(([name, total]) => ({ name, total })),
  };
}

async function findBill(actor: Actor, id: string) {
  const [bill] = await db
    .select()
    .from(purchaseBills)
    .where(and(eq(purchaseBills.id, id), ownedBy(actor, purchaseBills.ownerId)));
  return bill ?? null;
}

export async function getBill(actor: Actor, id: string) {
  const bill = await findBill(actor, id);
  if (!bill) return null;
  const [lines, [supplier]] = await Promise.all([
    db
      .select({
        id: purchaseLines.id,
        productId: purchaseLines.productId,
        productName: products.name,
        quantity: purchaseLines.quantity,
        unitCost: purchaseLines.unitCost,
        taxRate: purchaseLines.taxRate,
      })
      .from(purchaseLines)
      .innerJoin(products, eq(products.id, purchaseLines.productId))
      .where(eq(purchaseLines.billId, id))
      .orderBy(asc(purchaseLines.position)),
    db.select().from(suppliers).where(eq(suppliers.id, bill.supplierId)),
  ]);
  return { bill, lines, supplier: supplier! };
}

async function prepare(input: z.infer<typeof billInput>) {
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId));
  if (!supplier) fail("No such supplier.");
  const ids = [...new Set(input.lines.map((line) => line.productId))];
  const found = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, ids));
  if (found.length !== ids.length) fail("A line's item is gone.");
  const totals = documentTotals(
    input.lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitCost,
      discountRate: 0,
      taxRate: line.taxRate,
    })),
    0,
  );
  return {
    totals: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total },
    lines: (billId: string) =>
      input.lines.map((line, position) => ({ ...line, id: newId(), billId, position })),
  };
}

export async function createBill(actor: Actor, input: z.infer<typeof billInput>) {
  const { totals, lines } = await prepare(input);
  const id = newId();
  await db.batch([
    db.insert(purchaseBills).values({
      id,
      ownerId: actor.id,
      supplierId: input.supplierId,
      reference: input.reference,
      billDate: input.billDate,
      notes: input.notes,
      status: "draft",
      ...totals,
    }),
    db.insert(purchaseLines).values(lines(id)),
  ]);
  return { id };
}

export async function updateBill(
  actor: Actor,
  id: string,
  input: z.infer<typeof billInput>,
) {
  const bill = await findBill(actor, id);
  if (!bill) fail("No such bill.");
  if (bill.status !== "draft") fail("A received bill can't be changed.");
  const { totals, lines } = await prepare(input);
  await db.batch([
    db
      .update(purchaseBills)
      .set({
        supplierId: input.supplierId,
        reference: input.reference,
        billDate: input.billDate,
        notes: input.notes,
        ...totals,
      })
      .where(and(eq(purchaseBills.id, id), eq(purchaseBills.status, "draft"))),
    db.delete(purchaseLines).where(eq(purchaseLines.billId, id)),
    db.insert(purchaseLines).values(lines(id)),
  ]);
  return { id };
}

export async function deleteBill(actor: Actor, id: string) {
  const bill = await findBill(actor, id);
  if (!bill) fail("No such bill.");
  if (bill.status !== "draft") fail("A received bill can't be deleted.");
  await db.batch([
    db.delete(purchaseLines).where(eq(purchaseLines.billId, id)),
    db
      .delete(purchaseBills)
      .where(and(eq(purchaseBills.id, id), eq(purchaseBills.status, "draft"))),
  ]);
}

/** Marks a bill received and adds its tracked products to stock, once. */
export async function receiveBill(actor: Actor, id: string) {
  const bill = await findBill(actor, id);
  if (!bill) fail("No such bill.");
  if (bill.status !== "draft") fail("This bill has already been received.");
  await batch([
    [
      `update purchase_bills set status = 'received', received_at = current_timestamp
        where id = ? and status = 'draft'`,
      id,
    ],
    [
      `insert into stock_movements (id, product_id, quantity, kind, ref_id, reason, user_id)
        select lower(hex(randomblob(16))), l.product_id, l.quantity, 'purchase', ?, '', ?
        from purchase_lines l join products p on p.id = l.product_id
        where l.bill_id = ? and p.track_stock = 1
          and not exists (select 1 from stock_movements where ref_id = ? and kind = 'purchase')`,
      id,
      actor.id,
      id,
      id,
    ],
  ]);
}
