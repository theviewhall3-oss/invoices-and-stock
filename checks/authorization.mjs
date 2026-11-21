// Who may reach what: the perimeter, the share pages, one member's records
// against another's, and the actions only admins may take.
import { startRuntime } from '/home/user/oss-new/control/runtime/index.mjs';
import { capture, createClient, expect, expectRefused, fillDocument, isoDay, replay, submit } from './lib.mjs';

const runtime = await startRuntime();
try {
  // Anonymous and outsider are refused everywhere private; members get in.
  await runtime.assertPrivateAccess([
    '/', '/clients', '/quotes', '/quotes/new', '/invoices', '/invoices/new', '/payments',
    '/products', '/suppliers', '/purchases', '/purchases/new', '/expenses', '/reports', '/settings',
  ]);

  // No sign-in of the app's own (X001): the Gateway does it.
  for (const path of ['/login', '/signin', '/signup', '/register', '/logout']) {
    const anonymous = await runtime.fetch(path);
    expect(anonymous.status, `${path} anonymous`).not.toBe(200);
    const member = await runtime.fetch(path, { role: 'member' });
    expect(member.status, `${path} member`).not.toBe(200);
    expect(await member.text()).not.toMatch(/type="password"/);
  }

  const owner = await (await runtime.context('owner')).newPage();
  const member = await (await runtime.context('member')).newPage();

  // The owner's private records.
  await owner.goto('/settings');
  await owner.getByLabel('Business name').fill('Owner Workshop');
  const saveSettings = await capture(owner, owner.getByRole('button', { name: 'Save settings' }));
  await createClient(owner, { name: 'Owner Private Client Ltd', email: 'private@owner.example' });
  await owner.getByRole('link', { name: 'Owner Private Client Ltd' }).click();
  const ownerClientUrl = new URL(owner.url()).pathname;
  await owner.getByRole('button', { name: 'Edit client' }).click();
  await owner.getByRole('dialog').getByLabel('Phone').fill('555-0100');
  const updateClient = await capture(owner, owner.getByRole('dialog').getByRole('button', { name: 'Save client' }));

  await owner.goto('/invoices/new');
  await fillDocument(owner, {
    client: 'Owner Private Client Ltd', endLabel: 'Due date', endDate: isoDay(30),
    lines: [{ description: 'Private consulting', quantity: 1, price: 500, tax: 0 }],
  });
  await Promise.all([owner.waitForURL(/\/invoices\/(?!new$)[^/]+$/), owner.getByRole('button', { name: 'Save invoice' }).click()]);
  const ownerInvoiceUrl = new URL(owner.url()).pathname;
  await owner.getByRole('button', { name: 'Issue invoice' }).click();
  await submit(owner, owner.getByRole('alertdialog').getByRole('button', { name: 'Issue' }));
  await expect(owner.getByTestId('doc-status')).toHaveText('Unpaid');
  const ownerShare = new URL(await owner.getByTestId('share-link').inputValue()).pathname;

  // A member sees none of it, by list or by address.
  await member.goto('/clients');
  await expect(member.getByRole('heading', { level: 1 })).toHaveText('Clients');
  await expect(member.getByText('Owner Private Client Ltd')).toHaveCount(0);
  await member.goto(ownerClientUrl);
  await expect(member.getByText('Owner Private Client Ltd')).toHaveCount(0);
  await expect(member.getByTestId('not-found')).toBeVisible();
  await member.goto('/invoices');
  await expect(member.getByText('Owner Private Client Ltd')).toHaveCount(0);
  await member.goto(ownerInvoiceUrl);
  await expect(member.getByTestId('not-found')).toBeVisible();
  await expect(member.getByText('Private consulting')).toHaveCount(0);
  await member.goto('/payments');
  await member.goto('/');
  await expect(member.getByTestId('outstanding')).toHaveText('$0.00');

  // ...nor changes it, even replaying the owner's own request.
  const tampered = await replay(runtime, updateClient, 'member');
  await expectRefused(tampered, 'No such client.');
  const db = await runtime.database();
  const client = await db.prepare('select phone from clients where name = ?').bind('Owner Private Client Ltd').first();
  expect(client.phone).toBe('555-0100');

  // The member's own client is theirs; the admin sees it too.
  await createClient(member, { name: 'Member Bakery' });
  await owner.goto('/clients');
  await expect(owner.getByTestId('client-row').filter({ hasText: 'Member Bakery' })).toBeVisible();

  // Admin-only: settings, catalog, suppliers and voiding.
  await member.goto('/settings');
  await expect(member.getByLabel('Business name')).toHaveValue('Owner Workshop');
  await expect(member.getByLabel('Business name')).toBeDisabled();
  await expect(member.getByRole('button', { name: 'Save settings' })).toHaveCount(0);
  const reSave = await replay(runtime, saveSettings, 'member');
  await expectRefused(reSave, 'Only an admin can do that.');
  await owner.goto('/settings');
  await owner.getByLabel('Business name').fill('Changed By Owner');
  await submit(owner, owner.getByRole('button', { name: 'Save settings' }));
  const replayed = await replay(runtime, saveSettings, 'member');
  await expectRefused(replayed, 'Only an admin can do that.');
  const business = await db.prepare('select business_name from settings where id = 1').first();
  expect(business.business_name).toBe('Changed By Owner');

  await member.goto('/products');
  await expect(member.getByRole('heading', { level: 1 })).toHaveText('Products and services');
  await expect(member.getByRole('button', { name: 'New item' })).toHaveCount(0);
  await member.goto('/suppliers');
  await expect(member.getByRole('button', { name: 'New supplier' })).toHaveCount(0);

  await member.goto('/invoices/new');
  await fillDocument(member, {
    client: 'Member Bakery', endLabel: 'Due date', endDate: isoDay(30),
    lines: [{ description: 'Bread baskets', quantity: 3, price: 20, tax: 0 }],
  });
  await Promise.all([member.waitForURL(/\/invoices\/(?!new$)[^/]+$/), member.getByRole('button', { name: 'Save invoice' }).click()]);
  await member.getByRole('button', { name: 'Issue invoice' }).click();
  await submit(member, member.getByRole('alertdialog').getByRole('button', { name: 'Issue' }));
  await expect(member.getByTestId('doc-status')).toHaveText('Unpaid');
  await expect(member.getByRole('button', { name: 'Void invoice' })).toHaveCount(0);
  const memberInvoiceUrl = new URL(member.url()).pathname;
  await owner.goto(memberInvoiceUrl);
  await owner.getByRole('button', { name: 'Void invoice' }).click();
  const voidCall = await capture(owner, owner.getByRole('alertdialog').getByRole('button', { name: 'Void' }));
  await expect(owner.getByTestId('doc-status')).toHaveText('Void');
  expect(voidCall.method()).toBe('POST');

  // Share pages show the document by its link and nothing else.
  const shared = await runtime.fetch(ownerShare);
  expect(shared.status).toBe(200);
  const html = await shared.text();
  expect(html).toContain('Private consulting');
  expect(html).not.toContain('owner@example.test');
  expect(html).not.toContain('private@owner.example');
  const guessed = await runtime.fetch('/s/i/not-a-real-share-token');
  expect(guessed.status).toBe(404);
  expect(await guessed.text()).not.toContain('Private consulting');
  const guessedQuote = await runtime.fetch('/s/q/not-a-real-share-token/respond', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'answer=accept',
  });
  expect(guessedQuote.status).toBe(404);
  // Only the share pages are public: the app's own data calls are not.
  expect((await runtime.fetch('/s/i')).status).not.toBe(200);
} finally {
  await runtime.close();
}
