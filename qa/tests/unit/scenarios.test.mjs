import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateOffset, orderReference, salesOrder, synthetic } from '../../support/scenarios.mjs';
import { localBaseURL } from '../../support/runtime.mjs';

for (const [name, scenario] of Object.entries(synthetic.orders)) {
  test(`fixture ${name} adds up in integer cents`, () => {
    const cents = scenario.lines.reduce((sum, { sku, qty }) => {
      assert.ok(Number.isInteger(qty) && qty > 0);
      const rate = synthetic.items[sku].rateCents;
      assert.ok(Number.isInteger(rate) && rate > 0);
      return sum + rate * qty;
    }, 0);
    assert.equal(cents, scenario.totalCents);
  });
}

for (const [date, offset, expected] of [
  ['2028-02-28', 1, '2028-02-29'],
  ['2028-03-01', -1, '2028-02-29'],
  ['2027-12-31', 7, '2028-01-07'],
  ['2030-01-01', -1, '2029-12-31'],
  ['2027-11-07', 1, '2027-11-08'],
]) {
  test(`date ${date} with offset ${offset} yields ${expected}`, () => {
    assert.equal(dateOffset(date, offset), expected);
  });
}

for (const [date, offset] of [['2026-02-30', 1], ['2026-3-04', 1], ['2026-03-04', 1.5]]) {
  test(`invalid date/offset ${date}, ${offset} is rejected`, () => {
    assert.throws(() => dateOffset(date, offset), TypeError);
  });
}

test('builds the mixed draft with the stored SKUs and delivery date', () => {
  const site = { company: 'Synthetic Company', customer: 'Synthetic Customer', today: '2026-11-30' };
  const order = salesOrder(site, 'QA-MIXED', synthetic.orders.mixed);
  assert.equal(order.company, site.company);
  assert.equal(order.customer, site.customer);
  assert.equal(order.po_no, 'QA-MIXED');
  assert.deepEqual(order.items, [
    { item_code: 'QA-SYN-LUMEN-CAL', qty: 2, delivery_date: '2026-12-07' },
    { item_code: 'QA-SYN-RELAY-MAP', qty: 3, delivery_date: '2026-12-07' },
  ]);
  assert.ok(order.items.every(line => !('rate' in line)), 'ERPNext must look up the real item price');
});

test('a negative scenario cannot mutate the shared golden data', () => {
  const site = { company: 'Synthetic Company', customer: 'Synthetic Customer', today: '2026-11-30' };
  const bad = salesOrder(site, 'QA-ZERO', synthetic.orders.single);
  bad.items[0].qty = synthetic.negative.zeroQuantity;
  assert.equal(salesOrder(site, 'QA-OK', synthetic.orders.single).items[0].qty, 2);
});

test('parallel cases can use the same fixture without reusing order references', () => {
  const refs = new Set(Array.from({ length: 32 }, () => orderReference('unit')));
  assert.equal(refs.size, 32);
  assert.ok([...refs].every(ref => ref.startsWith('QA-unit-')));
});

test('fixture identity is visibly synthetic and contains no contact fields', () => {
  assert.match(synthetic.company.name, /^QA Synthetic /);
  assert.match(synthetic.customer.name, /^QA Synthetic /);
  assert.deepEqual(Object.keys(synthetic.customer).sort(), ['group', 'name', 'type']);
  assert.equal(new Set(synthetic.items.map(item => item.code)).size, synthetic.items.length);
  assert.ok(synthetic.items.every(item => item.code.startsWith('QA-SYN-')));
  assert.ok(!synthetic.items.some(item => item.code === synthetic.negative.missingItemCode));
});

test('the test origin is loopback with a validated port', () => {
  assert.equal(localBaseURL('18080'), 'http://127.0.0.1:18080');
  assert.throws(() => localBaseURL('65536'), /TCP port/);
  assert.throws(() => localBaseURL('example.invalid'), /TCP port/);
  assert.throws(() => localBaseURL('00080'), /TCP port/);
});
