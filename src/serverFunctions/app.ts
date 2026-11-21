import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import * as clients from "@/server/clients";
import * as expenses from "@/server/expenses";
import * as invoices from "@/server/invoices";
import * as payments from "@/server/payments";
import * as products from "@/server/products";
import * as purchases from "@/server/purchases";
import * as quotes from "@/server/quotes";
import * as reports from "@/server/reports";
import * as settings from "@/server/settings";
import * as suppliers from "@/server/suppliers";
import { documentInput } from "@/server/documents";
import { actorMiddleware } from "./middleware";

// Every function runs behind actorMiddleware: `context.actor` is the member
// the Gateway signed in, and every query is scoped by it.

const id = z.object({ id: z.string() });
const parse =
  <T extends z.ZodTypeAny>(schema: T) =>
  (data: unknown): z.infer<T> =>
    schema.parse(data);

// Who is signed in, and the business details documents show.
export const getSession = createServerFn()
  .middleware([actorMiddleware])
  .handler(async ({ context: { actor } }) => ({
    actor: { email: actor.email, admin: actor.admin },
    business: await settings.getSettings(),
    // Where share links point: this app's own address, as the request reached it.
    origin: new URL(getRequest().url).origin,
  }));

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(settings.settingsInput))
  .handler(({ data, context }) => settings.updateSettings(context.actor, data));

// Clients
export const getClients = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(z.object({ search: z.string().default("") })))
  .handler(({ data, context }) =>
    clients.listClients(context.actor, data.search),
  );
export const getClient = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    clients.getClientDetail(context.actor, data.id),
  );
export const createClient = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(clients.clientInput))
  .handler(({ data, context }) => clients.createClient(context.actor, data));
export const updateClient = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ client: clients.clientInput })))
  .handler(({ data, context }) =>
    clients.updateClient(context.actor, data.id, data.client),
  );
export const deleteClient = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => clients.deleteClient(context.actor, data.id));

// Catalog and stock
export const getProducts = createServerFn()
  .middleware([actorMiddleware])
  .handler(() => products.listProducts());
export const getPickable = createServerFn()
  .middleware([actorMiddleware])
  .handler(() => products.pickableProducts());
export const getProduct = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data }) => products.getProduct(data.id));
export const createProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(products.productInput))
  .handler(({ data, context }) => products.createProduct(context.actor, data));
export const updateProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ product: products.productInput })))
  .handler(({ data, context }) =>
    products.updateProduct(context.actor, data.id, data.product),
  );
export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ archived: z.boolean() })))
  .handler(({ data, context }) =>
    products.setArchived(context.actor, data.id, data.archived),
  );
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    products.deleteProduct(context.actor, data.id),
  );
export const adjustStock = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(products.adjustmentInput))
  .handler(({ data, context }) => products.adjustStock(context.actor, data));

// Quotes
export const getQuotes = createServerFn()
  .middleware([actorMiddleware])
  .validator(
    parse(
      z.object({
        status: z
          .enum(["draft", "sent", "accepted", "declined", "invoiced"])
          .optional(),
        clientId: z.string().optional(),
      }),
    ),
  )
  .handler(({ data, context }) => quotes.listQuotes(context.actor, data));
export const getQuote = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => quotes.getQuote(context.actor, data.id));
export const createQuote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(documentInput))
  .handler(({ data, context }) => quotes.createQuote(context.actor, data));
export const updateQuote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ document: documentInput })))
  .handler(({ data, context }) =>
    quotes.updateQuote(context.actor, data.id, data.document),
  );
export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => quotes.deleteQuote(context.actor, data.id));
export const sendQuote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => quotes.markQuoteSent(context.actor, data.id));
export const convertQuote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => quotes.convertQuote(context.actor, data.id));

// Invoices and credit notes
export const getInvoices = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(invoices.invoiceFilters))
  .handler(({ data, context }) => invoices.listInvoices(context.actor, data));
export const getInvoice = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => invoices.getInvoice(context.actor, data.id));
export const createInvoice = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(documentInput))
  .handler(({ data, context }) => invoices.createInvoice(context.actor, data));
export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ document: documentInput })))
  .handler(({ data, context }) =>
    invoices.updateInvoice(context.actor, data.id, data.document),
  );
export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    invoices.deleteInvoice(context.actor, data.id),
  );
export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    invoices.issueInvoice(context.actor, data.id),
  );
export const voidInvoice = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => invoices.voidInvoice(context.actor, data.id));
export const createCreditNote = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(invoices.creditNoteInput))
  .handler(({ data, context }) =>
    invoices.createCreditNote(context.actor, data),
  );

// Payments
export const getPayments = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(payments.paymentFilters))
  .handler(({ data, context }) => payments.listPayments(context.actor, data));
export const recordPayment = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(payments.paymentInput))
  .handler(({ data, context }) => payments.recordPayment(context.actor, data));
export const deletePayment = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    payments.deletePayment(context.actor, data.id),
  );

// Suppliers, purchases and expenses
export const getSuppliers = createServerFn()
  .middleware([actorMiddleware])
  .handler(() => suppliers.listSuppliers());
export const createSupplier = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(suppliers.supplierInput))
  .handler(({ data, context }) =>
    suppliers.createSupplier(context.actor, data),
  );
export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ supplier: suppliers.supplierInput })))
  .handler(({ data, context }) =>
    suppliers.updateSupplier(context.actor, data.id, data.supplier),
  );
export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    suppliers.deleteSupplier(context.actor, data.id),
  );

const month = z.object({ month: z.string().optional() });
export const getBills = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(month))
  .handler(({ data, context }) =>
    purchases.listBills(context.actor, data.month),
  );
export const getBill = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => purchases.getBill(context.actor, data.id));
export const createBill = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(purchases.billInput))
  .handler(({ data, context }) => purchases.createBill(context.actor, data));
export const updateBill = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ bill: purchases.billInput })))
  .handler(({ data, context }) =>
    purchases.updateBill(context.actor, data.id, data.bill),
  );
export const deleteBill = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) => purchases.deleteBill(context.actor, data.id));
export const receiveBill = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    purchases.receiveBill(context.actor, data.id),
  );

export const getExpenses = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(month))
  .handler(({ data, context }) =>
    expenses.listExpenses(context.actor, data.month),
  );
export const createExpense = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(expenses.expenseInput))
  .handler(({ data, context }) => expenses.createExpense(context.actor, data));
export const updateExpense = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id.extend({ expense: expenses.expenseInput })))
  .handler(({ data, context }) =>
    expenses.updateExpense(context.actor, data.id, data.expense),
  );
export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(parse(id))
  .handler(({ data, context }) =>
    expenses.deleteExpense(context.actor, data.id),
  );

// Dashboard and reports
export const getDashboard = createServerFn()
  .middleware([actorMiddleware])
  .handler(({ context }) => reports.dashboard(context.actor));
export const getReports = createServerFn()
  .middleware([actorMiddleware])
  .validator(parse(z.object({ from: z.string(), to: z.string() })))
  .handler(async ({ data, context }) => {
    const [sales, aging, profit] = await Promise.all([
      reports.salesByMonth(context.actor),
      reports.receivablesAging(context.actor),
      reports.profit(context.actor, data.from, data.to),
    ]);
    return { sales, aging, profit };
  });
