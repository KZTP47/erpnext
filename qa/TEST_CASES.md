# Sales order test cases

A saved draft should retain its customer, items, delivery dates and prices when read back. A rejected request should return a useful error and leave existing data intact. That matters when an integration needs to correct its input and retry.

| Case | Path | Input or action | Expected result |
| --- | --- | --- | --- |
| API-01 | Golden | Read the test customer and an item as a salesperson | The API reports the expected user, customer and item. |
| API-02 | Golden | Create a draft with two services and different quantities | ERPNext looks up the prices and saves both lines with a total of USD 359.90. |
| API-03 | Golden | Give the two lines different delivery dates | The order uses the latest line date and keeps the original dates on both lines. |
| API-04 | Golden | Change the quantity on a saved draft | A fresh read returns the new quantity and total. The order is still a draft. |
| API-05 | Golden | Submit a valid draft | A lookup by purchase order reference returns the order with `docstatus: 1`. |
| API-06 | Negative | Set a line quantity to zero | ERPNext rejects the quantity. A lookup by reference returns zero orders. |
| API-07 | Negative | Set delivery before the order date | ERPNext rejects the date. A lookup by reference returns zero orders. |
| API-08 | Negative | Use an item code that does not exist | ERPNext rejects the item link. A lookup by reference returns zero orders. |
| API-09 | Negative | Send an order without line items | ERPNext should return a validation error and save zero orders. See the known issue below. |
| API-10 | Negative | Try to save a quantity of zero on an existing draft | The previous quantity and total are preserved. |
| UI-01 | Golden | Create an order in Desk with a customer, delivery date, reference and item | ERPNext saves a draft with the correct line and price. |
| UI-02 | Negative and recovery | Set quantity to zero in Desk, try to save, then enter a valid quantity and save again | Desk shows the error and the original value stays saved. The second save persists the corrected quantity and total. |
| UI-03 | Golden | Submit a prepared draft in Desk and reload the page | Desk shows the submitted order. An API read confirms its status and total. |

## Synthetic data

Codex generated the [test catalog](fixtures/sales.json) for a fictional company selling two services. The customer name and item codes carry QA prefixes. The catalog contains no personal addresses, contact details or imported customer records. The test account uses the reserved domain `example.invalid`.

Two calibrations at USD 124.75 and three mappings at USD 36.80 should total USD 359.90. The fixture records that expected amount. Unit tests check the calculation in integer cents. The API and browser tests compare the expected amount with what ERPNext saves. The fixture is checked into the repository, so repeated runs need no live AI model. A random suffix keeps purchase order references unique across runs.

The synthetic customer uses untaxed orders. Payments, invoices, tax calculation, stock balances and accounting entries are outside the scope of the suite.

## Known issue in ERPNext 16.60.0

API-09 expects HTTP 417 with a validation error. ERPNext 16.60.0 returns HTTP 500 with a `TypeError` for this case. The test first looks up the order reference and fails if any order was saved. It marks that specific status and error type as an expected failure. Any other unexpected response fails the test. Once ERPNext returns the expected validation error, the case passes normally.
