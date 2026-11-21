# Invoices and Stock

Quotes, invoices, payments and stock for a small business, run by your team. Clients open a link to accept a quote or see what they owe.

Inspired by https://daftra.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Admins set the business name, address, currency, default tax, payment terms and next document numbers.
- Keep clients with their quotes, invoices, payments and outstanding balance.
- Keep a catalog of products and services, with stock on hand, movements, adjustments and low-stock flags.
- Write quotes and send a link the client uses to accept or decline, then turn them into invoices.
- Issue numbered invoices with a client link, and return items with credit notes.
- Record full or partial payments and browse them all in one list.
- Track suppliers, purchase bills that add stock, and expenses by category and month.
- See this month's sales, what is owed and overdue, sales by month, receivables aging and profit.

Left out: accounts and sign-in, which your Gateway handles; mobile and offline apps; tax-authority e-invoicing; online card payments; full double-entry accounting; point of sale; HR and payroll; operations modules; multiple warehouses and purchase orders; recurring invoices, reminders and sending by email.

## Setup

```sh
pnpm install
pnpm dev                         # run locally behind the dev Gateway
pnpm test                        # unit tests
node checks/behavior.mjs         # release checks; run them through the oss.new runtime
pnpm run deploy                  # deploy to your Gateway
```

Or install the released app with `pnpm everyapp install <repository url>`.

There are no secrets or settings to set. The database is created on deploy, and the business details are entered in the app's Settings page by an admin.

## Limitations

- Members see only the clients, documents and expenses they created; admins see everything. A client belongs to the member who added it.
- Amounts are in one currency, with two decimal places.
- Documents are shared by link only; the app sends no email.
- Stock may go below zero when an invoice is issued for more than is on hand.
- Online payments and Gateway sign-in flows were not exercised by the local checks.
