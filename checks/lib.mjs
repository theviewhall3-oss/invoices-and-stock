// Helpers the suites share. Selectors come from the app's markup: labels,
// button names and data-testid attributes.
import { expect } from '/home/user/oss-new/control/runtime/index.mjs';

export { expect };

export const isoDay = (offset = 0) => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};

/** Picks an option in a labelled select. */
export async function pick(page, label, option) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Clicks a button that saves through a server function and waits for it. */
export async function submit(page, locator) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/_serverFn/') && r.request().method() === 'POST'),
    locator.click(),
  ]);
}

/** Clicks and captures the POST the page sends to a server function. */
export async function capture(page, locator) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/_serverFn/') && r.method() === 'POST'),
    locator.click(),
  ]);
  await request.response();
  return request;
}

/** Sends a captured server-function call again as another role. */
export async function replay(runtime, request, role) {
  const url = new URL(request.url());
  const headers = { ...request.headers() };
  for (const name of Object.keys(headers)) {
    if (['cookie', 'host', 'origin', 'referer', 'content-length'].includes(name.toLowerCase()) || name.startsWith(':')) delete headers[name];
  }
  return runtime.fetch(url.pathname + url.search, { role, method: 'POST', headers, body: request.postData() ?? undefined });
}

export async function createClient(page, client) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'New client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(client.name);
  if (client.company) await dialog.getByLabel('Company').fill(client.company);
  if (client.email) await dialog.getByLabel('Email').fill(client.email);
  await submit(page, dialog.getByRole('button', { name: 'Save client' }));
  await expect(page.getByTestId('client-row').filter({ hasText: client.name })).toBeVisible();
}

/** Fills the quote or invoice editor; `lines` are { item?, description?, quantity, price, tax? }. */
export async function fillDocument(page, { client, issueDate, endLabel, endDate, lines, discount }) {
  await pick(page, 'Client', client);
  if (issueDate) await page.getByLabel('Issue date').fill(issueDate);
  if (endDate) await page.getByLabel(endLabel).fill(endDate);
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    if (index > 0) await page.getByRole('button', { name: 'Add line' }).click();
    if (line.item) await pick(page, `Item ${n}`, line.item);
    if (line.description) await page.getByLabel(`Description ${n}`).fill(line.description);
    await page.getByLabel(`Quantity ${n}`).fill(String(line.quantity));
    if (line.price !== undefined) await page.getByLabel(`Unit price ${n}`).fill(String(line.price));
    if (line.tax !== undefined) await page.getByLabel(`Tax ${n}`).fill(String(line.tax));
  }
  if (discount !== undefined) await page.getByLabel('Document discount (%)').fill(String(discount));
}

/** A server function refusal: an error status, or the serialized error TanStack Start answers with. */
export async function expectRefused(response, message) {
  const body = await response.text();
  expect(response.status >= 400 || body.includes('$TSR/Error'), `refused: ${response.status} ${body.slice(0, 200)}`).toBe(true);
  if (message) expect(body).toContain(message);
}
