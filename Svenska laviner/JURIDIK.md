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
   borttaget, och en kontaktpunkt. **Byggt 8 oktober 2026:** turer, delade
   rutter, kommentarer och profiler kan också anmälas (kommentarer döljs
   efter tre anmälningar), och den som får något borttaget av admin får en
   notis med skälet. Kvar att fråga: räcker det, och behövs ett sätt att
   överklaga inne i appen (i dag via mejl)?
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
9. **Namnet "Snöläge".** Sökt 7 oktober 2026: inga varumärken "Snöläge",
   "Snolage" eller liknande hos PRV eller i TMview. Den enda träffen var
   ett fordonspatent, som inte spelar någon roll. Namnet är fritt att
   använda. Registrera det själv (PRV, klass 9 och eventuellt 41 och 42)
   innan bred lansering om du vill skydda det.
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

## Patent, varumärke och licenser (19 oktober 2026)

Ingen juridisk rådgivning, utan en karta över läget. Avgifter ändras: kolla
aktuella belopp hos PRV och EUIPO innan du ansöker.

**Patent: inte värt det för Snöläge i dag.**
- Datorprogram "som sådana" går inte att patentera i Sverige eller hos det
  europeiska patentverket (patentlagen 1 kap., EPC art. 52). Det krävs en ny
  teknisk lösning med uppfinningshöjd.
- Positionsdelning med tidsgräns finns redan i Google Maps, Apple Hitta,
  Snapchat-kartan, Garmin LiveTrack, Strava Beacon och Life360, så den är
  inte ny. Samma sak gäller prognos, karta och turdagbok.
- Pappas sensoridé (känna av en begravning och larma) är det enda som skulle
  kunna vara patenterbart, om det blir en ny teknisk lösning, troligen med
  hårdvara. Två saker att veta:
  1. **Berätta inte om den offentligt** (video, inlägg, presentation) innan
     du har bestämt dig. I Europa förstör en offentlig beskrivning före
     ansökan nyheten; det finns ingen respitperiod.
  2. Telefoner sänder inte på lavinsändarnas 457 kHz och signaler från
     telefon (mobilnät, wifi, Bluetooth, GPS) dämpas kraftigt i snö. Den
     kanadensiska lavincentralen varnade 2013 för appar som påstod sig
     ersätta sändare/mottagare. En sådan funktion får aldrig marknadsföras
     som räddningsutrustning.
- Kostnad om det ändå blir aktuellt: själva PRV-ansökan är några tusen
  kronor, men ett patentombud kostar ofta 30 000–100 000 kr för en svensk
  ansökan, och skydd i flera länder betydligt mer. Gratis rådgivning finns
  hos PRV och Almi.

**Varumärke: det här är värt pengarna, när appen har fått fäste.**
- Namnet är det som går att skydda och det som konkurrenter kan härma.
  Namnkollen 7 oktober hittade inga krockar för "Snöläge"/"Snolage" hos PRV
  eller i TMview.
- Klasser: **9** (nedladdningsbar programvara, appar), **42** (programvara
  som tjänst, plattformar på nätet), möjligen **41** (utbildning, till
  exempel säkerhetsguiden).
- Sverige via PRV (e-tjänst, ett par tusen kronor för första klassen plus
  avgift per extra klass), eller hela EU via EUIPO (850 euro för en klass, 50
  euro för den andra, 150 euro per klass därefter). Skyddet gäller 10 år och
  kan förnyas.
- Ordmärke ("Snöläge") först; logotypen kan vänta.
- Domänerna snolage.se, snöläge.se, snolage.online och snöläge.online är
  redan köpta.

**Upphovsrätt till koden och innehållet.**
- Upphovsrätt uppstår automatiskt. Repot är privat och har ingen
  licensfil, så ingen annan får använda koden. Behåll det så.
- Koden är till stor del skriven med AI-hjälp. Hur långt upphovsrätten
  sträcker sig för AI-genererad kod är juridiskt oklart (det krävs mänskligt
  skapande). Det praktiska skyddet är därför att hålla koden hemlig (privat
  repo) och att skydda namnet som varumärke.
- Användarnas inlägg: villkoren ger Snöläge rätt att visa dem så länge de
  ligger kvar. Ingen ändring behövs.

**Licenser vi använder (inkommande).**
- Öppen källkod: bygget skriver `licenser.txt` med alla npm-paket som ingår
  i appen och deras licenstexter (MIT, Apache 2.0, BSD, ISC, OFL för
  typsnittet, Hippocratic 2.1 för React Leaflet). Den länkas från
  `/om-appen` under Källor. Kvar: de inbyggda Android- och iOS-biblioteken
  (AndroidX, Firebase-SDK:n, Capacitor) har egna licenser. Google brukar visa
  dem i en "Licenser för öppen källkod"-vy i appen; det kan läggas till.
- Garmins FIT-SDK används inte längre i appen (egen läsare sedan 17 oktober).
- Data: Lantmäteriet (CC BY 4.0, kreditering finns), SMHI (CC BY 4.0),
  Naturvårdsverket (öppna API:er; skicka mejlet om bred användning och spara
  svaret), OpenStreetMap (ODbL, kreditering finns), Mapterhorn (kreditering
  finns).

**Dela position, juridiskt.**
- Positionen är en personuppgift. Rättslig grund är avtalet (användaren
  slår på det själv). Bara senaste punkten sparas, högst 12 timmar, inte i
  säkerhetskopior. Integritetspolicyn och villkoren är uppdaterade 19
  oktober.
- Villkoren säger nu tydligt att funktionen inte är någon larm- eller
  räddningstjänst. Fråga juristen om det räcker som ansvarsbegränsning.
- Google Play, Data safety: platsen är redan deklarerad som insamlad för
  appens funktion. Delning som användaren själv startar med andra användare
  räknas enligt Googles definition inte som "delning med tredje part".
  Granska ändå svaret nästa gång du uppdaterar formuläret.
