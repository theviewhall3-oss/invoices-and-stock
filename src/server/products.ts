import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  invoiceLines,
  products,
  purchaseLines,
  quoteLines,
  stockMovements,
  users,
} from "@/db/schema";
import { fail, newId, requireAdmin, type Actor } from "./actor";

export const productInput = z.object({
  kind: z.enum(["product", "service"]),
  sku: z.string().trim().max(100).default(""),
  name: z.string().trim().min(1, "Name is required").max(200),
  unit: z.string().trim().max(50).default(""),
  price: z.number().int().min(0),
  cost: z.number().int().min(0),
  taxRate: z.number().min(0).max(100),
  trackStock: z.boolean(),
  lowStockLevel: z.number().min(0),
});

export const adjustmentInput = z.object({
  productId: z.string(),
  quantity: z
    .number()
    .refine((value) => value !== 0, "Enter a quantity other than zero"),
  reason: z.string().trim().min(1, "Give a reason").max(500),
});

// Written out in full, so the subquery's columns can't bind to the wrong table.
const onHandColumn = sql<number>`coalesce((select sum(m.quantity) from stock_movements m where m.product_id = "products"."id"), 0)`;

export async function listProducts(options: { archived?: boolean } = {}) {
  const rows = await db
    .select({
      id: products.id,
      kind: products.kind,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      price: products.price,
      cost: products.cost,
      taxRate: products.taxRate,
      trackStock: products.trackStock,
      lowStockLevel: products.lowStockLevel,
      archived: products.archived,
      onHand: onHandColumn,
    })
    .from(products)
    .where(
      options.archived === undefined
        ? undefined
        : eq(products.archived, options.archived),
    )
    .orderBy(products.name);
  return rows.map((row) => ({ ...row, low: isLow(row) }));
}

function isLow(row: {
  trackStock: boolean;
  onHand: number;
  lowStockLevel: number;
}): boolean {
  return row.trackStock && row.onHand <= row.lowStockLevel;
}

export async function lowStock() {
  return (await listProducts({ archived: false })).filter((row) => row.low);
}

export async function getProduct(id: string) {
  const [product] = await db
    .select({
      id: products.id,
      kind: products.kind,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      price: products.price,
      cost: products.cost,
      taxRate: products.taxRate,
      trackStock: products.trackStock,
      lowStockLevel: products.lowStockLevel,
      archived: products.archived,
      onHand: onHandColumn,
    })
    .from(products)
    .where(eq(products.id, id));
  if (!product) return null;
  const movements = await db
    .select({
      id: stockMovements.id,
      quantity: stockMovements.quantity,
      kind: stockMovements.kind,
      reason: stockMovements.reason,
      refId: stockMovements.refId,
      createdAt: stockMovements.createdAt,
      by: users.email,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(eq(stockMovements.productId, id))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id));
  return { product: { ...product, low: isLow(product) }, movements };
}

export async function createProduct(
  actor: Actor,
  input: z.infer<typeof productInput>,
) {
  requireAdmin(actor);
  const [product] = await db
    .insert(products)
    .values({
      id: newId(),
      ...input,
      trackStock: input.kind === "product" && input.trackStock,
    })
    .returning({ id: products.id });
  return product!;
}

export async function updateProduct(
  actor: Actor,
  id: string,
  input: z.infer<typeof productInput>,
) {
  requireAdmin(actor);
  const [product] = await db
    .update(products)
    .set({ ...input, trackStock: input.kind === "product" && input.trackStock })
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return product ?? fail("No such item.");
}

export async function setArchived(actor: Actor, id: string, archived: boolean) {
  requireAdmin(actor);
  const [product] = await db
    .update(products)
    .set({ archived })
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return product ?? fail("No such item.");
}

async function isUsed(id: string): Promise<boolean> {
  const [row] = await db
    .select({
      used: sql<number>`exists (select 1 from ${quoteLines} where ${quoteLines.productId} = ${id})
        or exists (select 1 from ${invoiceLines} where ${invoiceLines.productId} = ${id})
        or exists (select 1 from ${purchaseLines} where ${purchaseLines.productId} = ${id})
        or exists (select 1 from ${stockMovements} where ${stockMovements.productId} = ${id})`,
    })
    .from(sql`(select 1)`);
  return Boolean(row?.used);
}

export async function deleteProduct(actor: Actor, id: string) {
  requireAdmin(actor);
  if (await isUsed(id))
    fail("This item is on documents or has stock history. Archive it instead.");
  await db.delete(products).where(eq(products.id, id));
}

export async function adjustStock(
  actor: Actor,
  input: z.infer<typeof adjustmentInput>,
) {
  requireAdmin(actor);
  const [product] = await db
    .select({ trackStock: products.trackStock })
    .from(products)
    .where(eq(products.id, input.productId));
  if (!product) fail("No such item.");
  if (!product.trackStock) fail("Stock isn't tracked for this item.");
  await db.insert(stockMovements).values({
    id: newId(),
    productId: input.productId,
    quantity: input.quantity,
    kind: "adjustment",
    reason: input.reason,
    userId: actor.id,
  });
}

/** Catalog items a member can put on a document. */
export async function pickableProducts() {
  return db
    .select({
      id: products.id,
      kind: products.kind,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      price: products.price,
      cost: products.cost,
      taxRate: products.taxRate,
    })
    .from(products)
    .where(and(eq(products.archived, false)))
    .orderBy(products.name);
}
