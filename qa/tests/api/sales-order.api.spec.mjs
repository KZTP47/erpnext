import { expect, messages, orderPath, readJson, responseData, test } from '../../support/erp.mjs';
import { dateOffset, orderReference, salesOrder, synthetic } from '../../support/scenarios.mjs';

const catalog = synthetic.items;
const cases = synthetic.orders;

test('API-01 golden: authenticates as the synthetic sales manager and reads the catalog', async ({ erp, site }) => {
  const user = await responseData(await erp.request.get('/api/method/frappe.auth.get_logged_user'));
  expect(user).toBe(site.username);
  const customer = await responseData(await erp.request.get(`/api/resource/Customer/${encodeURIComponent(site.customer)}`));
  expect(customer).toMatchObject({ customer_name: synthetic.customer.name, customer_type: synthetic.customer.type });
  const item = await responseData(await erp.request.get(`/api/resource/Item/${catalog[0].code}`));
  expect(item).toMatchObject({ item_code: catalog[0].code, item_name: catalog[0].label, is_sales_item: 1 });
});

test('API-02 golden: creates and reads back a draft with real price-list totals', async ({ erp, site }) => {
  const reference = orderReference('api-mixed');
  const input = salesOrder(site, reference, cases.mixed);
  const created = await erp.create(input);
  const persisted = await erp.read(created.name);
  expect(persisted).toMatchObject({
    customer: site.customer, company: site.company, docstatus: 0, po_no: reference,
    currency: synthetic.company.currency, grand_total: cases.mixed.totalCents / 100,
  });
  expect(persisted.items.map(({ item_code, qty, rate, amount }) => ({ item_code, qty, rate, amount }))).toEqual(
    cases.mixed.lines.map(({ sku, qty }) => ({ item_code: catalog[sku].code, qty,
      rate: catalog[sku].rateCents / 100, amount: qty * catalog[sku].rateCents / 100 })),
  );
});

test('API-03 golden: order delivery follows the latest scheduled item', async ({ erp, site }) => {
  const input = salesOrder(site, orderReference('api-latest'), cases.mixed);
  input.items[1].delivery_date = dateOffset(site.today, 12);
  const created = await erp.create(input);
  const persisted = await erp.read(created.name);
  expect(persisted.delivery_date).toBe(input.items[1].delivery_date);
  expect(persisted.items.map(item => item.delivery_date)).toEqual(input.items.map(item => item.delivery_date));
});

test('API-04 golden: editing a draft recalculates its total', async ({ erp, site }) => {
  const created = await erp.create(salesOrder(site, orderReference('api-update'), cases.single));
  expect(created.grand_total).toBe(cases.single.totalCents / 100);
  const qty = cases.changed.lines[0].qty;
  await responseData(await erp.request.put(orderPath(created.name), {
    data: { items: [{ ...created.items[0], qty }] },
  }));
  const persisted = await erp.read(created.name);
  expect(persisted).toMatchObject({ docstatus: 0, grand_total: cases.changed.totalCents / 100 });
  expect(persisted.items[0].qty).toBe(qty);
});

test('API-05 golden: submits a valid draft and finds it under its purchase-order reference', async ({ erp, site }) => {
  const reference = orderReference('api-submit');
  const created = await erp.create(salesOrder(site, reference, cases.oneRelay));
  const submitted = await responseData(await erp.request.post('/api/method/frappe.client.submit', {
    data: { doc: { ...created, doctype: 'Sales Order' } },
  }));
  expect(submitted).toMatchObject({ name: created.name, docstatus: 1 });
  expect(await erp.find(reference)).toEqual([{ name: created.name, po_no: reference, docstatus: 1 }]);
  expect((await erp.read(created.name)).grand_total).toBe(cases.oneRelay.totalCents / 100);
});

const negativeOrders = [
  {
    id: 'API-06', title: 'zero line quantity', type: 'InvalidQtyError',
    message: /Quantity for Item .* cannot be zero/i,
    change: input => { input.items[0].qty = synthetic.negative.zeroQuantity; },
  },
  {
    id: 'API-07', title: 'an item delivery before the order date', type: 'ValidationError',
    message: /Expected Delivery Date should be after Sales Order Date/i,
    change: (input, site) => { input.items[0].delivery_date = dateOffset(site.today, synthetic.negative.deliveryOffset); },
  },
  {
    id: 'API-08', title: 'a nonexistent item link', type: 'LinkValidationError',
    message: /QA-SYN-NONEXISTENT-47/,
    change: input => { input.items[0].item_code = synthetic.negative.missingItemCode; },
  },
];

for (const { id, title, type, message, change } of negativeOrders) {
  test(`${id} negative: rejects ${title} without creating an order`, async ({ erp, site }) => {
    const reference = orderReference(id);
    const input = salesOrder(site, reference, cases.single);
    change(input, site);
    const response = await erp.post(input);
    const body = await readJson(response);
    expect(response.status(), JSON.stringify({ type: body.exc_type, messages: messages(body) })).toBe(417);
    expect(body.exc_type).toBe(type);
    expect(messages(body)).toMatch(message);
    expect(await erp.find(reference)).toEqual([]);
  });
}

test('API-09 negative: validates an empty order without persisting it', async ({ erp, site }) => {
  const reference = orderReference('API-09');
  const input = { ...salesOrder(site, reference, cases.single), items: [] };
  const response = await erp.post(input);
  const body = await readJson(response);
  // A side effect must fail this case even when the known response error is present.
  expect(await erp.find(reference)).toEqual([]);
  if (response.status() === 500 && body.exc_type === 'TypeError' && !process.env.ERP_QA_STRICT_EMPTY_ORDER) {
    const defect = 'ERPNext 17.0.0-dev returns HTTP 500 TypeError for an empty Sales Order';
    console.log(`[expected failure] API-09: ${defect}`);
    test.fail(true, defect);
  }
  expect(response.status()).toBe(417);
  expect(['ValidationError', 'MandatoryError']).toContain(body.exc_type);
  expect(messages(body)).toMatch(/items?/i);
});

test('API-10 negative: a rejected update preserves the previous draft and its total', async ({ erp, site }) => {
  const draft = await erp.create(salesOrder(site, orderReference('api-rollback'), cases.single));
  const response = await erp.request.put(orderPath(draft.name), {
    data: { items: [{ ...draft.items[0], qty: synthetic.negative.zeroQuantity }] },
  });
  const body = await readJson(response);
  expect(response.status()).toBe(417);
  expect(body.exc_type).toBe('InvalidQtyError');
  expect(messages(body)).toMatch(/cannot be zero/i);
  const saved = await erp.read(draft.name);
  expect(saved).toMatchObject({ docstatus: 0, grand_total: cases.single.totalCents / 100 });
  expect(saved.items[0].qty).toBe(cases.single.lines[0].qty);
});
