# Juridisk genomgång (inför bred lansering)

Genomgång gjord 7 oktober 2026 av Claude. **Det här är ingen juridisk
rådgivning.** Det är en checklista som gör ett möte med en jurist kort och
billigt. Texterna finns på `/om-appen#villkor` och `/om-appen#integritet`
(`app/src/pages/AboutPage.tsx`).

## Gjort i appen

- **Användarvillkor (nytt):** vem som driver tjänsten, att allt är
  beslutsstöd och inte en garanti (lavinrisk är ditt eget ansvar),
  åldersgräns 13 år, regler för innehåll, att användaren behåller rätten
  till sitt innehåll och ger Snöläge en begränsad licens att visa det,
  anmälan och borttagning, ansvarsbegränsning "i den utsträckning lagen
  tillåter", ändringar och svensk lag.
- **Registrering:** obligatorisk kryssruta "Jag har läst och godkänner
  användarvillkoren och är minst 13 år". Servern kräver den och sparar
  tidpunkten (`users.terms_accepted_at`, migration 0016).
- **Integritetspolicyn kompletterad:**
  - personuppgiftsansvarig (namn och e-post)
  - datum för senaste uppdatering
  - rättslig grund även för säkerhet, robotskydd och anmälningar
    (berättigat intresse, art. 6.1 f)
  - alla mottagare: Cloudflare, Resend, Google/Firebase, Apple
  - tjänster appen anropar direkt (SMHI, Mapterhorn, OpenStreetMap,
    Turnstile)
  - kompletta lagringstider, inklusive säkerhetskopior upp till 30 dagar
  - alla rättigheter: tillgång, rättelse, radering, dataportabilitet,
    begränsning och invändning, svar inom en månad, klagomål till IMY
  - Health Connect och Apple Hälsa (används aldrig för reklam)

## Frågor till en jurist

Ungefär i prioritetsordning:

1. **Ansvar för lavininformationen.** Räcker friskrivningen ("beslutsstöd,
   ingen garanti", "i den utsträckning lagen tillåter") om någon skadas
   efter att ha litat på en farograd, en lutningskarta, ruttanalysen eller
   en annan användares observation? Konsumenter kan inte avtala bort allt
   ansvar, och vårdslöshet täcks inte av friskrivningar. Bör du ha en
   **ansvarsförsäkring**?
2. **Privatperson eller företag?** Appen drivs i dag av dig privat. Med
   reklam, avgifter eller många användare kan en enskild firma eller ett AB
   vara bättre för ansvar, moms och försäkring. Det påverkar också vem som
   står som personuppgiftsansvarig och i butikerna.
3. **Rättsakten om digitala tjänster (DSA).** Snöläge är en
   värdtjänst/onlineplattform för användarinnehåll. Mikroföretag är
   undantagna från mycket, men inte från "anmälan och åtgärd" (finns: tre
   anmälningar döljer en observation), motivering till den som får innehåll
   borttaget, och en kontaktpunkt. **Saknas i dag:** anmälan av kommentarer,
   turer och profiler, och ett automatiskt besked med skäl när något tas
   bort.
4. **Hälsodata (GDPR art. 9).** Pass och GPS-rutter från Health Connect och
   Apple Hälsa: är det "uppgifter om hälsa"? Vi läser bara pass och rutter,
   aldrig puls eller vikt, och de blir privata turer. Om juristen anser att
   det är hälsodata krävs uttryckligt samtycke, en extra kryssruta vid
   kopplingen.
5. **Åldersgräns.** 13 år följer den svenska gränsen för samtycke till
   informationssamhällets tjänster. Men tjänsten bygger på avtal, och
   butikernas åldersmärkning gäller också. Rimligt, eller 16 år?
6. **Personuppgiftsbiträdesavtal.** Bekräfta att standardavtalen gäller och
   är accepterade: Cloudflare (ingår i villkoren), Resend (DPA på deras
   sida), Google Firebase (godkänn "Data Processing Terms" i
   Firebase-konsolen).
7. **Tredjelandsöverföring.** Alla leverantörer är amerikanska.
   Policyn hänvisar till EU–US Data Privacy Framework och
   standardavtalsklausuler. Kontrollera att varje leverantör är certifierad.
8. **Exakta platser i observationer.** Observationer visar en exakt
   kartpunkt för alla. Vanligen ingen personuppgift, men kombinerat med
   användarnamn och tid kan det avslöja var någon var. Räcker informationen
   i policyn?
9. **Namnet "Snöläge".** Gör en varumärkessökning hos PRV och EUIPO innan du
   marknadsför brett.
10. **Licenser för data.** Lantmäteriet (CC BY 4.0, källa angiven),
    Naturvårdsverket (öppna API:er, terränglager godkända av Petter
    Palmgren 2026-10-07; spara mejlet), SMHI (öppna data), Mapterhorn
    (attribution finns). Inget att göra om villkoren inte ändras.

## Inte juridik, men bra att veta

- Butikerna kräver integritetspolicy-länk, radera-konto-länk
  (`/om-appen#radera-konto`) och sanna svar i Data safety / App Privacy, se
  `APPAR.md`.
- Ändras policyn eller villkoren väsentligt: uppdatera datumet högst upp och
  berätta det i appen.
