# ERPNext sales order tests

A salesperson picks a service and a delivery date, saves a draft and submits the order in ERPNext. The suite checks what ERPNext calculates, what it rejects and what it saves.

## Test pyramid

| Layer | Where to look | What it checks |
| --- | --- | --- |
| Unit | [Delivery rules](tests/unit/delivery_rules.py) and [fixtures and date helpers](tests/unit/scenarios.test.mjs) | Fast checks for date boundaries and fixture totals. The delivery tests call the real `SalesOrder` method and stub its message handling. |
| API | [Sales orders through Frappe REST](tests/api/sales-order.api.spec.mjs) | Pricing, line items, dates, draft edits, submission and validation. The tests read back saved state through the same HTTP interface an integration uses. |
| End to end | [Desk workflows in Chromium](tests/e2e/sales-order.e2e.spec.mjs) | A salesperson creates a draft, corrects a validation error or submits an order in Desk. Each case reads the order back through REST to verify what was saved. |

The suite uses the published container for ERPNext v16.60.0 (`886ab6ae187244e7f1b852393384ab6019d56264`). To test changes to ERPNext itself, build an image from the modified source. The API and browser tests use a test account with the `Sales User` and `Sales Manager` roles on a disposable site.

## Run the suite

Install Node.js 22 or later, Docker with Linux container support and Docker Compose 2.24.4 or later. Start at the repository root.

```sh
cd qa
npm ci
npm run test:unit
npx playwright install chromium
npm run stack:up
npm run test:domain
npm run test:api
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` if the browser libraries are missing. The first start may take a few minutes while Docker pulls ERPNext, MariaDB and Redis and creates a fresh site. The site listens at `http://127.0.0.1:18080`. If that port is busy, set `ERP_QA_PORT` to a free port before `stack:up` and keep that value for the test run.

Each test order uses a unique purchase order reference, so you can leave a previous run's orders in place while debugging. Run `npm run stack:down` when you're done to remove the test stack and its Docker volumes. After editing `fixtures/sales.json`, run `stack:down` before the next `stack:up` to load the new catalog and prices into a fresh site.

## Troubleshoot a failure

- Run one case with `npm run test:api -- --grep API-07` or `npm run test:e2e -- --grep UI-02`.
- If the site fails to start, run `npm run stack:logs` for the site setup, backend and web server logs.
- For a browser failure, check the screenshot in `test-results/`. Add `--headed` to watch the browser locally.
- For a REST failure, check the HTTP status, ERPNext error type and message. For rejected orders, the suite also looks up the purchase order reference to see whether an order was saved.

[Test cases and synthetic data](TEST_CASES.md)

## References

- [Frappe REST API](https://docs.frappe.io/framework/user/en/api/rest)
- [ERPNext Sales Order controller in v16.60.0](https://github.com/frappe/erpnext/blob/v16.60.0/erpnext/selling/doctype/sales_order/sales_order.py)
- [Pinned Docker Compose configuration](https://github.com/frappe/frappe_docker/blob/48b9479a9697d0049e795fd7b682eb6544923410/pwd.yml)
