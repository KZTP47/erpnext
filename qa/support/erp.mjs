import { expect, test as base } from '@playwright/test';
import { readSite } from './runtime.mjs';

const orders = '/api/resource/Sales%20Order';

export function orderPath(name) {
  return `${orders}/${encodeURIComponent(name)}`;
}

export async function readJson(response) {
  expect(response.headers()['content-type'], `Content type for ${response.url()}`).toContain('application/json');
  return response.json();
}

export async function responseData(response, expected = 200) {
  const body = await readJson(response);
  expect(response.status(), JSON.stringify({ type: body.exc_type, messages: messages(body) })).toBe(expected);
  return body.data ?? body.message;
}

export function messages(body) {
  return JSON.parse(body._server_messages ?? '[]').map(encoded => JSON.parse(encoded).message).join(' ');
}

export const test = base.extend({
  site: async ({}, use) => use(readSite()),
  erp: async ({ playwright, site }, use) => {
    const request = await playwright.request.newContext({
      baseURL: site.baseURL,
      extraHTTPHeaders: { Authorization: `token ${site.apiKey}:${site.apiSecret}`, Accept: 'application/json' },
      timeout: 20_000,
      maxRedirects: 0,
    });
    const erp = {
      request,
      async post(payload) { return request.post(orders, { data: payload }); },
      async create(payload) { return responseData(await this.post(payload)); },
      async read(name) { return responseData(await request.get(orderPath(name))); },
      async find(reference) {
        return responseData(await request.get(orders, { params: {
          filters: JSON.stringify([['po_no', '=', reference]]),
          fields: JSON.stringify(['name', 'po_no', 'docstatus']),
        } }));
      },
    };
    try {
      await use(erp);
    } finally {
      await request.dispose();
    }
  },
});

export { expect };
