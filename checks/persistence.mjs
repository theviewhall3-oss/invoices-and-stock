// Records survive a restart of the Workers on the same storage.
import { startRuntime } from '/home/user/oss-new/control/runtime/index.mjs';
import { createClient, expect, fillDocument, isoDay, submit } from './lib.mjs';

const runtime = await startRuntime();
try {
  let page = await (await runtime.context('owner')).newPage();
  await createClient(page, { name: 'Cedar Row Florist', email: 'hello@cedarrow.example' });
  await page.goto('/invoices/new');
  await fillDocument(page, {
    client: 'Cedar Row Florist', endLabel: 'Due date', endDate: isoDay(30),
    lines: [{ description: 'Window planters', quantity: 2, price: 80, tax: 0 }],
  });
  await Promise.all([page.waitForURL(/\/invoices\/(?!new$)[^/]+$/), page.getByRole('button', { name: 'Save invoice' }).click()]);
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await submit(page, page.getByRole('alertdialog').getByRole('button', { name: 'Issue' }));
  await expect(page.getByTestId('invoice-total')).toHaveText('$160.00');
  const invoiceUrl = new URL(page.url()).pathname;
  const share = new URL(await page.getByTestId('share-link').inputValue()).pathname;

  await runtime.restart();

  page = await (await runtime.context('owner')).newPage();
  await page.goto('/clients');
  await expect(page.getByTestId('client-row').filter({ hasText: 'Cedar Row Florist' })).toBeVisible();
  await page.goto(invoiceUrl);
  await expect(page.getByTestId('invoice-total')).toHaveText('$160.00');
  await expect(page.getByTestId('doc-status')).toHaveText('Unpaid');
  const view = await runtime.fetch(share);
  expect(view.status).toBe(200);
  expect(await view.text()).toContain('Window planters');
} finally {
  await runtime.close();
}
