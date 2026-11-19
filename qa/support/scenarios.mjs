import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export const synthetic = JSON.parse(readFileSync(new URL('../fixtures/sales.json', import.meta.url), 'utf8'));

export function dateOffset(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate || !Number.isInteger(days)) {
    throw new TypeError('Expected a valid YYYY-MM-DD and an integer offset');
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function orderReference(caseId) {
  return `QA-${caseId}-${randomUUID().slice(0, 12)}`;
}

export function salesOrder(site, reference, scenario, deliveryDays = 7) {
  const deliveryDate = dateOffset(site.today, deliveryDays);
  return {
    company: site.company,
    customer: site.customer,
    order_type: 'Sales',
    transaction_date: site.today,
    delivery_date: deliveryDate,
    currency: synthetic.company.currency,
    selling_price_list: 'Standard Selling',
    po_no: reference,
    ignore_pricing_rule: 1,
    items: scenario.lines.map(({ sku, qty }) => ({
      item_code: synthetic.items[sku].code,
      qty,
      delivery_date: deliveryDate,
    })),
  };
}
