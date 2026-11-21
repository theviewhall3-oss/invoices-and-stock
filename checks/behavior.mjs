// The main path of every retained feature, as an owner (admin) runs the
// business: settings, catalog and stock, a supplier bill, a client, a quote
// the client accepts by link, the invoice, a payment, a credit note, an
// expense, then the dashboard and reports.
import { startRuntime } from '/home/user/oss-new/control/runtime/index.mjs';
import { createClient, expect, fillDocument, isoDay, pick, submit } from './lib.mjs';

const runtime = await startRuntime();
try {
  const page = await (await runtime.context('owner')).newPage();

  // F001: business settings drive document defaults.
  await page.goto('/settings');
  await runtime.assertBackLink(page);
  await page.getByLabel('Business name').fill('Harbor Lane Woodworks');
  await page.getByLabel('Address').fill('14 Pier Road, Portland, ME');
  await page.getByLabel('Currency code').fill('USD');
  await page.getByLabel('Default tax rate (%)').fill('10');
  await page.getByLabel('Payment terms (days)').fill('30');
  await page.getByLabel('Next quote number').fill('501');
  await page.getByLabel('Next invoice number').fill('1001');
  await submit(page, page.getByRole('button', { name: 'Save settings' }));
  await page.reload();
  await expect(page.getByLabel('Business name')).toHaveValue('Harbor Lane Woodworks');
  await expect(page.getByLabel('Next invoice number')).toHaveValue('1001');

  // F003: catalog items, one tracked product and one service.
  await page.goto('/products');
  await page.getByRole('button', { name: 'New item' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('SKU').fill('OB-12');
  await dialog.getByLabel('Name', { exact: true }).fill('Oak cutting board');
  await dialog.getByLabel('Unit').fill('pc');
  await dialog.getByLabel('Sale price').fill('45');
  await dialog.getByLabel('Cost').fill('18');
  await expect(dialog.getByLabel('Tax rate (%)')).toHaveValue('10');
  await dialog.getByRole('checkbox', { name: 'Track stock' }).click();
  await dialog.getByLabel('Low-stock level').fill('5');
  await submit(page, dialog.getByRole('button', { name: 'Save item' }));
  await expect(page.getByTestId('product-row').filter({ hasText: 'Oak cutting board' })).toBeVisible();

  await page.getByRole('button', { name: 'New item' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Service' }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Custom engraving');
  await dialog.getByLabel('Sale price').fill('15');
  await submit(page, dialog.getByRole('button', { name: 'Save item' }));
  await expect(page.getByTestId('product-row').filter({ hasText: 'Custom engraving' })).toBeVisible();

  // F007: a supplier, and a bill that adds stock when received.
  await page.goto('/suppliers');
  await page.getByRole('button', { name: 'New supplier' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Northwood Timber');
  await dialog.getByLabel('Email').fill('orders@northwood.example');
  await submit(page, dialog.getByRole('button', { name: 'Save supplier' }));
  await expect(page.getByTestId('supplier-row').filter({ hasText: 'Northwood Timber' })).toBeVisible();

  await page.goto('/purchases/new');
  await pick(page, 'Supplier', 'Northwood Timber');
  await page.getByLabel('Reference').fill('NT-2207');
  await pick(page, 'Item 1', 'Oak cutting board');
  await page.getByLabel('Quantity 1').fill('12');
  await page.getByLabel('Unit cost 1').fill('18');
  await page.getByLabel('Tax 1').fill('0');
  await Promise.all([page.waitForURL(/\/purchases\/(?!new$)[^/]+$/), page.getByRole('button', { name: 'Save bill' }).click()]);
  await expect(page.getByTestId('bill-total')).toHaveText('$216.00');
  await submit(page, page.getByRole('button', { name: 'Mark received' }));
  await expect(page.getByTestId('doc-status')).toHaveText('Received');

  // F003: on hand comes from movements; an admin adjusts with a reason.
  await page.goto('/products');
  await page.getByTestId('product-row').filter({ hasText: 'Oak cutting board' }).getByRole('link', { name: 'Oak cutting board' }).click();
  await expect(page.getByTestId('on-hand')).toHaveText('12');
  await page.getByRole('button', { name: 'Adjust stock' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quantity change').fill('-1');
  await dialog.getByLabel('Reason').fill('Split during sanding');
  await submit(page, dialog.getByRole('button', { name: 'Save adjustment' }));
  await expect(page.getByTestId('on-hand')).toHaveText('11');
  await expect(page.getByTestId('movement-row').filter({ hasText: 'Split during sanding' })).toBeVisible();
  const productUrl = page.url();

  // F002: clients, searchable.
  await createClient(page, { name: 'Maple Street Café', company: 'Maple Street Hospitality', email: 'orders@maplestreet.example' });
  await createClient(page, { name: 'Bayside Deli' });
  await page.getByLabel('Search clients').fill('maple');
  await expect(page.getByTestId('client-row')).toHaveCount(1);
  await expect(page.getByTestId('client-row')).toContainText('Maple Street Café');

  // F004: a quote with catalog and free-text lines, sent by link.
  await page.goto('/quotes/new');
  await fillDocument(page, {
    client: 'Maple Street Café',
    endLabel: 'Expiry date',
    endDate: isoDay(14),
    lines: [
      { item: 'Oak cutting board', quantity: 6 },
      { description: 'Logo engraving, per board', quantity: 6, price: 15, tax: 10 },
    ],
  });
  await expect(page.getByTestId('doc-total')).toHaveText('$396.00');
  await Promise.all([page.waitForURL(/\/quotes\/(?!new$)[^/]+$/), page.getByRole('button', { name: 'Save quote' }).click()]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Q-0501');
  await expect(page.getByTestId('doc-status')).toHaveText('Draft');
  await submit(page, page.getByRole('button', { name: 'Mark as sent' }));
  await expect(page.getByTestId('doc-status')).toHaveText('Sent');
  const quoteLink = await page.getByTestId('share-link').inputValue();
  expect(new URL(quoteLink).hostname).toBe(runtime.hostname);
  const quoteUrl = page.url();

  // The client opens the link without signing in and accepts, once.
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto(quoteLink);
  await expect(visitor.getByRole('heading', { level: 1 })).toContainText('Q-0501');
  await expect(visitor.getByText('Harbor Lane Woodworks')).toBeVisible();
  await expect(visitor.getByTestId('share-total')).toHaveText('$396.00');
  await Promise.all([visitor.waitForURL(/\/s\/q\//), visitor.getByRole('button', { name: 'Accept quote' }).click()]);
  await expect(visitor.getByTestId('share-status')).toHaveText('Accepted');
  await expect(visitor.getByRole('button', { name: 'Accept quote' })).toHaveCount(0);
  const sharePath = new URL(quoteLink).pathname;
  const again = await runtime.fetch(`${sharePath}/respond`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'answer=decline',
  });
  expect(again.status).toBe(303);
  expect(again.headers.get('location')).toContain('closed');

  // A sent quote past its expiry can't be answered.
  await page.goto('/quotes/new');
  await fillDocument(page, {
    client: 'Bayside Deli', issueDate: isoDay(-40), endLabel: 'Expiry date', endDate: isoDay(-10),
    lines: [{ item: 'Custom engraving', quantity: 2 }],
  });
  await Promise.all([page.waitForURL(/\/quotes\/(?!new$)[^/]+$/), page.getByRole('button', { name: 'Save quote' }).click()]);
  await submit(page, page.getByRole('button', { name: 'Mark as sent' }));
  const expiredPath = new URL(await page.getByTestId('share-link').inputValue()).pathname;
  const expired = await runtime.fetch(`${expiredPath}/respond`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'answer=accept',
  });
  expect(expired.status).toBe(303);
  expect(expired.headers.get('location')).toContain('expired');
  const expiredView = await runtime.fetch(expiredPath);
  expect(expiredView.status).toBe(200);
  expect(await expiredView.text()).toContain('Expired');

  // F004 → F005: the accepted quote becomes a draft invoice, once.
  await page.goto(quoteUrl);
  await expect(page.getByTestId('doc-status')).toHaveText('Accepted');
  await Promise.all([page.waitForURL(/\/invoices\/(?!new$)[^/]+$/), page.getByRole('button', { name: 'Convert to invoice' }).click()]);
  await expect(page.getByTestId('doc-status')).toHaveText('Draft');
  await expect(page.getByTestId('invoice-total')).toHaveText('$396.00');
  await expect(page.getByTestId('due-date')).toHaveText(new Date(`${isoDay(30)}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
  const invoiceUrl = page.url();
  await page.goto(quoteUrl);
  await expect(page.getByTestId('doc-status')).toHaveText('Invoiced');
  await expect(page.getByRole('button', { name: 'Convert to invoice' })).toHaveCount(0);

  // Issuing numbers the invoice, locks it, takes stock and makes its link.
  await page.goto(invoiceUrl);
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await submit(page, page.getByRole('alertdialog').getByRole('button', { name: 'Issue' }));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('INV-1001');
  await expect(page.getByTestId('doc-status')).toHaveText('Unpaid');
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  const invoiceLink = await page.getByTestId('share-link').inputValue();
  expect(new URL(invoiceLink).hostname).toBe(runtime.hostname);
  await page.goto(productUrl);
  await expect(page.getByTestId('on-hand')).toHaveText('5');
  await expect(page.getByTestId('low-stock')).toBeVisible();

  // F006: payments, refusing more than the balance; deleting reopens it.
  await page.goto(invoiceUrl);
  await page.getByRole('button', { name: 'Record payment' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('1000');
  await submit(page, dialog.getByRole('button', { name: 'Save payment' }));
  await expect(dialog.getByRole('alert')).toContainText('more than the balance');
  await dialog.getByLabel('Amount').fill('20');
  await submit(page, dialog.getByRole('button', { name: 'Save payment' }));
  await expect(page.getByTestId('invoice-balance')).toHaveText('$376.00');
  await page.getByRole('button', { name: 'Delete payment of $20.00' }).click();
  await submit(page, page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }));
  await expect(page.getByTestId('invoice-balance')).toHaveText('$396.00');
  await page.getByRole('button', { name: 'Record payment' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('150');
  await pick(page, 'Method', 'Bank transfer');
  await dialog.getByLabel('Reference').fill('ACH 88213');
  await submit(page, dialog.getByRole('button', { name: 'Save payment' }));
  await expect(page.getByTestId('invoice-balance')).toHaveText('$246.00');
  await expect(page.getByTestId('doc-status')).toHaveText('Partially paid');

  // F005: a credit note returns a board: less to pay, stock back.
  await page.getByRole('button', { name: 'Credit note' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Return quantity 1').fill('1');
  await dialog.getByLabel('Reason').fill('One board arrived cracked');
  await submit(page, dialog.getByRole('button', { name: 'Save credit note' }));
  await expect(page.getByTestId('invoice-credited')).toHaveText('$49.50');
  await expect(page.getByTestId('invoice-balance')).toHaveText('$196.50');
  await page.goto(productUrl);
  await expect(page.getByTestId('on-hand')).toHaveText('6');

  // The client views the invoice by link without signing in.
  const invoiceView = await runtime.fetch(new URL(invoiceLink).pathname);
  expect(invoiceView.status).toBe(200);
  const invoiceHtml = await invoiceView.text();
  expect(invoiceHtml).toContain('INV-1001');
  expect(invoiceHtml).toContain('$196.50');
  await visitor.goto(invoiceLink);
  await expect(visitor.getByTestId('share-status')).toHaveText('Partially paid');

  // F005: lists filter by status, client and date.
  await page.goto('/invoices');
  await expect(page.getByTestId('invoice-row').filter({ hasText: 'INV-1001' })).toBeVisible();
  await pick(page, 'Status', 'Paid');
  await expect(page.getByTestId('invoice-row')).toHaveCount(0);
  await pick(page, 'Status', 'Partially paid');
  await expect(page.getByTestId('invoice-row')).toHaveCount(1);
  await pick(page, 'Client', 'Bayside Deli');
  await expect(page.getByTestId('invoice-row')).toHaveCount(0);

  // F002: the client page shows documents and balance; it can't be deleted.
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Maple Street Café' }).click();
  await expect(page.getByTestId('client-balance')).toHaveText('$196.50');
  await expect(page.getByTestId('client-invoices')).toContainText('INV-1001');
  await expect(page.getByTestId('client-quotes')).toContainText('Q-0501');
  await expect(page.getByTestId('client-payments')).toContainText('$150.00');
  await page.getByRole('button', { name: 'Delete client' }).click();
  await submit(page, page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }));
  await expect(page.getByText("This client has invoices, so it can't be deleted.")).toBeVisible();

  // F006: the payments list, filtered.
  await page.goto('/payments');
  await expect(page.getByTestId('payment-row')).toHaveCount(1);
  await expect(page.getByTestId('payment-row')).toContainText('ACH 88213');
  await pick(page, 'Method', 'Cash');
  await expect(page.getByTestId('payment-row')).toHaveCount(0);

  // F007: an expense, with totals by category for the period.
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'New expense' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category').fill('Packaging');
  await dialog.getByLabel('Amount').fill('35');
  await dialog.getByLabel('Note').fill('Kraft boxes and tissue');
  await submit(page, dialog.getByRole('button', { name: 'Save expense' }));
  await expect(page.getByTestId('expense-row').filter({ hasText: 'Kraft boxes and tissue' })).toBeVisible();
  await expect(page.getByTestId('category-total').filter({ hasText: 'Packaging' })).toContainText('$35.00');
  await expect(page.getByTestId('expenses-total')).toHaveText('$35.00');
  await page.goto('/purchases');
  await expect(page.getByTestId('purchases-total')).toHaveText('$216.00');

  // F008: the dashboard and reports.
  await page.goto('/');
  await expect(page.getByTestId('sales-this-month')).toHaveText('$396.00');
  await expect(page.getByTestId('outstanding')).toHaveText('$196.50');
  await expect(page.getByTestId('overdue-count')).toHaveText('0');
  await page.goto('/reports');
  await expect(page.getByTestId('sales-month').last()).toContainText('$396.00');
  await expect(page.getByTestId('aging-row').filter({ hasText: 'Maple Street Café' })).toContainText('$196.50');
  await expect(page.getByTestId('profit-sales')).toHaveText('$360.00');
  await expect(page.getByTestId('profit-credits')).toHaveText('$45.00');
  await expect(page.getByTestId('profit-purchases')).toHaveText('$216.00');
  await expect(page.getByTestId('profit-expenses')).toHaveText('$35.00');
  await expect(page.getByTestId('profit-total')).toHaveText('$64.00');

  // Phone-sized smoke: the dashboard and the menu fit a phone.
  const phone = await (await runtime.context('member', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto('/');
  await expect(phone.getByRole('heading', { level: 1 })).toBeVisible();
  await phone.getByRole('button', { name: 'Menu' }).click();
  await Promise.all([phone.waitForURL(/\/invoices$/), phone.getByRole('menuitem', { name: 'Invoices' }).click()]);
  await expect(phone.getByRole('heading', { level: 1 })).toHaveText('Invoices');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  // The picture: the invoice with its payment and credit note.
  await page.goto(invoiceUrl);
  await expect(page.getByTestId('invoice-balance')).toHaveText('$196.50');
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
