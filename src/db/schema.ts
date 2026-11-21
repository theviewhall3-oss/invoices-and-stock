import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Money is stored in minor units (cents). Rates are percentages (15 = 15%).
// Dates a person picks are YYYY-MM-DD text.

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** Members the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

/** One row (id 1): the business's details and document defaults. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  businessName: text("business_name").notNull().default(""),
  address: text("address").notNull().default(""),
  currencyCode: text("currency_code").notNull().default("USD"),
  defaultTaxRate: real("default_tax_rate").notNull().default(0),
  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
});

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    taxId: text("tax_id").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("clients_owner").on(t.ownerId)],
);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["product", "service"] }).notNull(),
  sku: text("sku").notNull().default(""),
  name: text("name").notNull(),
  unit: text("unit").notNull().default(""),
  price: integer("price").notNull().default(0),
  cost: integer("cost").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  trackStock: integer("track_stock", { mode: "boolean" })
    .notNull()
    .default(false),
  lowStockLevel: real("low_stock_level").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Quantity on hand is the sum of a product's movements. */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    quantity: real("quantity").notNull(),
    kind: text("kind", {
      enum: ["sale", "purchase", "credit", "adjustment", "void"],
    }).notNull(),
    refId: text("ref_id"),
    reason: text("reason").notNull().default(""),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product").on(t.productId)],
);

const documentColumns = () => ({
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  clientId: text("client_id").notNull(),
  issueDate: text("issue_date").notNull(),
  discountRate: real("discount_rate").notNull().default(0),
  notes: text("notes").notNull().default(""),
  shareToken: text("share_token").unique(),
  subtotal: integer("subtotal").notNull().default(0),
  discountTotal: integer("discount_total").notNull().default(0),
  taxTotal: integer("tax_total").notNull().default(0),
  total: integer("total").notNull().default(0),
  createdAt: createdAt(),
});

const lineColumns = () => ({
  id: text("id").primaryKey(),
  position: integer("position").notNull(),
  productId: text("product_id"),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  discountRate: real("discount_rate").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
});

export const quotes = sqliteTable(
  "quotes",
  {
    ...documentColumns(),
    number: integer("number").notNull(),
    status: text("status", {
      enum: ["draft", "sent", "accepted", "declined", "invoiced"],
    }).notNull(),
    expiryDate: text("expiry_date").notNull(),
    respondedAt: text("responded_at"),
    invoiceId: text("invoice_id").unique(),
  },
  (t) => [
    index("quotes_owner").on(t.ownerId),
    index("quotes_client").on(t.clientId),
  ],
);

export const quoteLines = sqliteTable(
  "quote_lines",
  { ...lineColumns(), quoteId: text("quote_id").notNull() },
  (t) => [index("quote_lines_quote").on(t.quoteId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    ...documentColumns(),
    number: integer("number").unique(),
    status: text("status", { enum: ["draft", "issued", "void"] }).notNull(),
    dueDate: text("due_date").notNull(),
    quoteId: text("quote_id").unique(),
  },
  (t) => [
    index("invoices_owner").on(t.ownerId),
    index("invoices_client").on(t.clientId),
  ],
);

export const invoiceLines = sqliteTable(
  "invoice_lines",
  { ...lineColumns(), invoiceId: text("invoice_id").notNull() },
  (t) => [index("invoice_lines_invoice").on(t.invoiceId)],
);

export const creditNotes = sqliteTable(
  "credit_notes",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    ownerId: text("owner_id").notNull(),
    date: text("date").notNull(),
    reason: text("reason").notNull().default(""),
    subtotal: integer("subtotal").notNull(),
    taxTotal: integer("tax_total").notNull(),
    total: integer("total").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("credit_notes_invoice").on(t.invoiceId)],
);

export const creditNoteLines = sqliteTable(
  "credit_note_lines",
  {
    id: text("id").primaryKey(),
    creditNoteId: text("credit_note_id").notNull(),
    invoiceLineId: text("invoice_line_id").notNull(),
    quantity: real("quantity").notNull(),
  },
  (t) => [index("credit_note_lines_note").on(t.creditNoteId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    ownerId: text("owner_id").notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    method: text("method", {
      enum: ["cash", "bank_transfer", "card", "cheque", "other"],
    }).notNull(),
    reference: text("reference").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("payments_invoice").on(t.invoiceId)],
);

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  createdAt: createdAt(),
});

export const purchaseBills = sqliteTable(
  "purchase_bills",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    reference: text("reference").notNull().default(""),
    billDate: text("bill_date").notNull(),
    status: text("status", { enum: ["draft", "received"] }).notNull(),
    notes: text("notes").notNull().default(""),
    subtotal: integer("subtotal").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    total: integer("total").notNull().default(0),
    receivedAt: text("received_at"),
    createdAt: createdAt(),
  },
  (t) => [index("purchase_bills_owner").on(t.ownerId)],
);

export const purchaseLines = sqliteTable(
  "purchase_lines",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull(),
    position: integer("position").notNull(),
    productId: text("product_id").notNull(),
    quantity: real("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
    taxRate: real("tax_rate").notNull().default(0),
  },
  (t) => [index("purchase_lines_bill").on(t.billId)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    date: text("date").notNull(),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
    supplierId: text("supplier_id"),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_owner").on(t.ownerId)],
);
