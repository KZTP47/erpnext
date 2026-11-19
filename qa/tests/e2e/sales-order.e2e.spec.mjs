import { expect, test } from '../../support/erp.mjs';
import { SalesOrderPage } from '../../support/sales-order-page.mjs';
import { dateOffset, orderReference, salesOrder, synthetic } from '../../support/scenarios.mjs';

const cases = synthetic.orders;

test('UI-01 golden: creates a priced order draft in Desk', async ({ page, erp, site }) => {
  const order = new SalesOrderPage(page, site);
  const reference = orderReference('ui-create');
  const delivery = dateOffset(site.today, 7);
  const line = cases.single.lines[0];
  await order.signIn();
  await order.startNew();
  await order.selectCustomer();
  await order.setDeliveryDate(delivery);
  await order.addItem(synthetic.items[line.sku], line.qty);
  await order.setReference(reference);
  await order.save();
  await expect(order.action('Submit')).toBeVisible();

  const found = await erp.find(reference);
  expect(found).toHaveLength(1);
  const persisted = await erp.read(found[0].name);
  expect(persisted).toMatchObject({ customer: site.customer, docstatus: 0,
    delivery_date: delivery, grand_total: cases.single.totalCents / 100 });
  expect(persisted.items).toHaveLength(1);
  expect(persisted.items[0]).toMatchObject({ item_code: synthetic.items[line.sku].code, qty: line.qty });
});

test('UI-02 negative: zero quantity is rejected, and the corrected draft is saved', async ({ page, erp, site }) => {
  const order = new SalesOrderPage(page, site);
  const initial = cases.oneRelay;
  const fixed = cases.threeRelays;
  const draft = await erp.create(salesOrder(site, orderReference('ui-zero'), initial));
  await order.signIn();
  await order.open(draft.name);
  await order.setQuantity(synthetic.negative.zeroQuantity);
  await order.save();
  const validation = page.getByRole('dialog').filter({ hasText: /Quantity for Item .* cannot be zero/i });
  await expect(validation).toBeVisible();
  const unchanged = await erp.read(draft.name);
  expect(unchanged.items[0].qty).toBe(initial.lines[0].qty);
  expect(unchanged.grand_total).toBe(initial.totalCents / 100);

  await validation.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(validation).toBeHidden();
  await order.setQuantity(fixed.lines[0].qty);
  await order.save();
  await expect(order.action('Submit')).toBeVisible();
  const corrected = await erp.read(draft.name);
  expect(corrected).toMatchObject({ docstatus: 0, grand_total: fixed.totalCents / 100 });
  expect(corrected.items[0].qty).toBe(fixed.lines[0].qty);
});

test('UI-03 golden: submits an existing order and reloads it as a submitted order', async ({ page, erp, site }) => {
  const order = new SalesOrderPage(page, site);
  const draft = await erp.create(salesOrder(site, orderReference('ui-submit'), cases.mixed));
  await order.signIn();
  await order.open(draft.name);
  await order.submit();
  await expect.poll(async () => (await erp.read(draft.name)).docstatus).toBe(1);
  await page.reload();
  await expect(order.action('Cancel')).toBeVisible();
  const saved = await erp.read(draft.name);
  expect(saved).toMatchObject({ docstatus: 1, grand_total: cases.mixed.totalCents / 100 });
  expect(saved.items.map(item => item.qty)).toEqual(cases.mixed.lines.map(line => line.qty));
});
