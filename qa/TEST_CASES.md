# Testfall för försäljningsorder

## Det sviten ska fånga

Ett korrekt orderutkast ska behålla kund, artiklar, leveransdatum och pris efter en ny läsning. En avvisad order ska ge ett begripligt fel och lämna tidigare data intakta. Det senare är viktigt för integrationer som kan behöva rätta sin indata och skicka om en begäran.

| Fall | Indata och handling | Förväntat resultat |
| --- | --- | --- |
| API-01 | Läs testkunden och en artikel som säljare | Autentiserad användare och affärsdata har rätt värden. |
| API-02 | Skapa ett utkast med två tjänster och olika antal | Båda raderna återfinns. ERPNext hämtar priserna och räknar fram 359,90 USD. |
| API-03 | Ge de två raderna olika leveransdatum | Orderns leveransdatum följer den senaste raden. Båda radvärdena bevaras. |
| API-04 | Ändra antal på ett sparat utkast | Nytt antal och ny totalsumma kan läsas tillbaka. Ordern ligger kvar som utkast. |
| API-05 | Skicka in ett giltigt utkast | Ordern kan hämtas via sin inköpsorderreferens och har status `docstatus: 1`. |
| API-06 | Sätt en rads antal till noll | ERPNext avvisar begäran. Referensen ger ingen sparad order. |
| API-07 | Sätt leveransdatum före orderdatum | ERPNext avvisar datumet. Referensen ger ingen sparad order. |
| API-08 | Ange en artikelkod som saknas | ERPNext avvisar artikellänken. Referensen ger ingen sparad order. |
| API-09 | Skicka en order utan rader | ERPNext bör svara med ett valideringsfel. Referensen ska ge noll order. Se den kända avvikelsen nedan. |
| API-10 | Försök spara antal noll på ett befintligt utkast | Det tidigare antalet och totalsumman bevaras. |
| UI-01 | Skapa en order i Desk med kund, datum, referens och artikel | Utkastet finns i ERPNext med rätt orderrad och pris. |
| UI-02 | Ändra antal till noll i Desk, spara, rätta och spara igen | Felmeddelandet visas. Först ligger originalvärdet kvar, sedan sparas det rättade antalet och totalsumman. |
| UI-03 | Skicka in ett förberett utkast och ladda om sidan | Det inskickade tillståndet syns i Desk. Status och belopp stämmer vid avläsning via API. |

## Syntetiska data

[Codex skapade testdatafilen](fixtures/sales.json) för en påhittad säljare med två tjänster till olika priser. Kundnamn och artikelkoder har QA-prefix. Katalogen innehåller inga privata adresser, kontaktuppgifter eller importerade kundposter. Testkontot använder den reserverade domänen `example.invalid`.

Två kalibreringar à 124,75 USD och tre kartläggningar à 36,80 USD ska ge 359,90 USD. Det förväntade beloppet finns i testdatafilen. Enhetstesterna verifierar beräkningen i heltalscent, medan API- och webbläsartesterna jämför mot ERPNexts sparade belopp. Det går att upprepa samma körning utan en aktiv AI-modell. Slumpdelen i orderreferensen används för att skilja körningar åt.

Testdata är avsiktligt begränsad till det som behövs för orderflödet. Den syntetiska testkunden använder order utan skatt. Betalningar, fakturor, skatteberäkning, lagersaldo och kostnadsföring ingår inte i arbetsprovet.

## Känd avvikelse i ERPNext 16.60.0

API-09 fick `HTTP 500` med feltypen `TypeError` i stället för det förväntade valideringsfelet. Fallet kontrolläser först orderreferensen och underkänner körningen om någon order har sparats. Sviten markerar just den kända svarskombinationen som ett förväntat fel. Ett annat oväntat svar underkänner testet. När ERPNext svarar med rätt valideringsfel går fallet igenom som vanligt.
