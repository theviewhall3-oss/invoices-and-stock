import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { products } from "@/db/schema";
import { documentTotals } from "@/lib/totals";
import { fail, newId, type Actor } from "./actor";
import { findClient as findOwnClient } from "./clients";

const lineInput = z.object({
  productId: z.string().nullable(),
  description: z.string().trim().min(1, "Each line needs a description").max(500),
  quantity: z.number().positive("Quantities must be above zero"),
  unitPrice: z.number().int().min(0),
  discountRate: z.number().min(0).max(100),
  taxRate: z.number().min(0).max(100),
});

export const documentInput = z.object({
  clientId: z.string().min(1, "Pick a client"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The quote's expiry date, or the invoice's due date. */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discountRate: z.number().min(0).max(100),
  notes: z.string().trim().max(5000).default(""),
  lines: z.array(lineInput).min(1, "Add at least one line").max(200),
});

export type DocumentInput = z.infer<typeof documentInput>;

/** Checks the client and catalog items, and works out the totals. */
export async function prepareDocument(actor: Actor, input: DocumentInput) {
  if (input.endDate < input.issueDate)
    fail("The end date can't be before the issue date.");
  if (!(await findOwnClient(actor, input.clientId))) fail("No such client.");
  const ids = [
    ...new Set(input.lines.flatMap((line) => line.productId ?? [])),
  ];
  if (ids.length) {
    const found = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, ids));
    if (found.length !== ids.length) fail("A line's catalog item is gone.");
  }
  const totals = documentTotals(input.lines, input.discountRate);
  const lines = input.lines.map((line, position) => ({
    ...line,
    id: newId(),
    position,
  }));
  return { totals, lines };
}
