import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices, quotes, settings } from "@/db/schema";
import { fail, requireAdmin, type Actor } from "./actor";

type BusinessSettings = typeof settings.$inferSelect;

export const settingsInput = z.object({
  businessName: z.string().trim().max(200),
  address: z.string().trim().max(1000),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency code is three letters, such as USD"),
  defaultTaxRate: z.number().min(0).max(100),
  paymentTermsDays: z.number().int().min(0).max(365),
  nextQuoteNumber: z.number().int().min(1),
  nextInvoiceNumber: z.number().int().min(1),
});

export async function getSettings(): Promise<BusinessSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select().from(settings).where(eq(settings.id, 1));
  return created!;
}

export async function updateSettings(
  actor: Actor,
  input: z.infer<typeof settingsInput>,
): Promise<BusinessSettings> {
  requireAdmin(actor);
  await getSettings();
  const [[usedInvoice], [usedQuote]] = await Promise.all([
    db.select({ n: max(invoices.number) }).from(invoices),
    db.select({ n: max(quotes.number) }).from(quotes),
  ]);
  if (usedInvoice?.n != null && input.nextInvoiceNumber <= usedInvoice.n)
    fail(`The next invoice number must be above ${usedInvoice.n}.`);
  if (usedQuote?.n != null && input.nextQuoteNumber <= usedQuote.n)
    fail(`The next quote number must be above ${usedQuote.n}.`);
  const [row] = await db
    .update(settings)
    .set(input)
    .where(eq(settings.id, 1))
    .returning();
  return row!;
}
