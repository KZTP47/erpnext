# Testautomation för försäljningsorder i ERPNext

En kund beställer en tjänst. Säljaren väljer artikel och leveransdatum, sparar ett utkast och skickar sedan in ordern i ERPNext. Sviten täcker orderflödet från beräkning och validering till sparat dokument i databasen.

| Nivå | Vad som körs | Varför den ligger här |
| --- | --- | --- |
| Enhet | [ERPNexts leveransregler](tests/unit/delivery_rules.py) samt [testdata och datumhjälpare](tests/unit/scenarios.test.mjs) | Snabba kontroller av gränsfall. Leveransreglerna anropar den riktiga `SalesOrder`-metoden med ersatt meddelandehantering. |
| API | [Försäljningsorder via Frappe REST](tests/api/sales-order.api.spec.mjs) | Kontrollerar pris, orderrader, datum, ändring, inskick, valideringsfel och sparat tillstånd genom samma HTTP-gränssnitt som en integration använder. |
| E2E | [Försäljningsorder i Desk med Chromium](tests/e2e/sales-order.e2e.spec.mjs) | Verifierar att en säljare kan skapa ett utkast, rätta ett fel och skicka in en order i gränssnittet. Varje test läser tillbaka ordern via REST. |

Sviten utgår från **ERPNext v16.60.0** (`886ab6ae187244e7f1b852393384ab6019d56264`). Den körs mot ERPNexts publicerade container för samma version. För att bedöma egna ändringar i ERPNexts produktkod behöver du bygga en image från den koden. Ett testkonto med rollerna `Sales User` och `Sales Manager` kör API- och webbläsartesterna mot den tillfälliga sajten.

## Kör sviten

Installera Node.js 22 eller nyare och Docker med Linux-containrar och Compose 2.24.4 eller nyare. Börja i repots rot.

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

På en Linux-maskin som saknar Chromium-bibliotek kör du `npx playwright install --with-deps chromium`. Första starten kan ta flera minuter eftersom ERPNext, MariaDB och Redis hämtas och en tom sajt skapas. Standardsajten nås på `http://127.0.0.1:18080`. Om porten är upptagen, sätt `ERP_QA_PORT` till en ledig port före `stack:up` och använd samma värde vid körning.

Testerna får skriva order i den tillfälliga sajten. Varje fall får en egen inköpsorderreferens, så en tidigare körning kan ligga kvar för felsökning. Kör `npm run stack:down` när du är klar. Kommandot tar bort teststacken och dess Docker-volymer. Om du ändrar katalogen i `fixtures/sales.json`, kör `stack:down` före nästa `stack:up` så att priser och övriga grunddata läses in på nytt.

## När ett test faller

- Isolera testet med `npm run test:api -- --grep API-07` eller `npm run test:e2e -- --grep UI-02`.
- Vid uppstartsproblem visar `npm run stack:logs` loggar för sajtinstallationen, backend och webbservern.
- Vid ett webbläsarfel sparas en skärmbild i `test-results/`. Lägg till `--headed` vid lokal felsökning.
- Ett fel i REST-lagret visar HTTP-status, ERPNexts feltyp och meddelande. För avvisade order läser sviten även tillbaka referensen för att se om något sparades.

[Testfall och syntetiska data](TEST_CASES.md)

## Källor

- [Frappe REST API](https://docs.frappe.io/framework/user/en/api/rest)
- [ERPNexts Sales Order-controller i v16.60.0](https://github.com/frappe/erpnext/blob/v16.60.0/erpnext/selling/doctype/sales_order/sales_order.py)
- [Versionslåst Docker-konfiguration](https://github.com/frappe/frappe_docker/blob/48b9479a9697d0049e795fd7b682eb6544923410/pwd.yml)
