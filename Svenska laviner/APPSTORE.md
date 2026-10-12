# App Store Connect – allt att fylla i

Allt nedan är färdigt att klistra in. Teckenantalen är kontrollerade mot
Apples gränser. Gör stegen i `APPAR.md` § 3 först (utvecklarkonto, App ID,
appen i App Store Connect, nyckel och GitHub-hemligheter), så att ett bygge
finns i TestFlight.

Primärt språk: **svenska**. Lägg till **engelska (Storbritannien)** under
*Lokaliseringar* och klistra in de engelska texterna där.

---

## 1. Appinformation (App Information)

| Fält | Värde |
|---|---|
| Namn (30) | `Snöläge: lavinprognos & turer` |
| Underrubrik (30) | `Lavinprognos, karta och turer` |
| Kategori | Primär **Sport**, sekundär **Väder** |
| Innehållsrättigheter | *Ja, appen visar innehåll från tredje part och jag har rätt att använda det* (Naturvårdsverkets öppna data, Lantmäteriets karta CC BY 4.0, SMHI:s öppna data, OpenStreetMap) |
| Åldersgräns | Se § 5 |

Engelska: namn `Snöläge: avalanche & ski tours`, underrubrik
`Avalanche forecasts for Sweden`.

## 2. Pris och tillgänglighet

- Pris: **Gratis**.
- Tillgänglighet: alla länder går bra (appen är på svenska och engelska).

## 3. Versionssidan (1.0)

**Reklamtext (170):**

> Dagens lavinprognos, väder och lutning på kartan – och turer, observationer och kompisarnas flöde. Allt samlat inför din tur i de svenska fjällen.

**Beskrivning:**

> Snöläge samlar det du behöver inför en tur i de svenska fjällen.
>
> LAVINPROGNOSEN
> • Dagens officiella lavinprognos från Naturvårdsverket för Sveriges sex prognosområden
> • Lavinproblemen med väderstreck och höjder, förväntad utveckling och de senaste dagarnas farograder
> • "Vad betyder det för mig?" – råd i klartext för varje farograd
> • Notis när farograden ändras i dina områden
>
> KARTAN
> • Lantmäteriets topografiska karta med lutning och sluttningsriktning
> • Planera en rutt och se höjdprofil, brant terräng och var rutten korsar det prognosen varnar för
> • Spara kartor och rutter för att använda dem utan täckning
>
> TURER OCH OBSERVATIONER
> • Turdagbok: hämta pass med GPS-rutt från Apple Hälsa eller ladda upp GPX- och FIT-filer
> • Snabbobservation i fält med stora knappar – sparas tills du har täckning igen
> • Följ kompisar, kommentera och planera turdagar tillsammans
>
> VÄDER
> • SMHI:s prognos med vindanalys som visar vilka sluttningar som troligen vindlastas
> • Snödjup från SMHI:s stationer och SMHI:s vädervarningar
>
> Snöläge är ett beslutsstöd. Appen ersätter inte den officiella lavinprognosen, en lavinutbildning eller ditt eget omdöme i fält.

**Sökord (100):**
`lavin,skidtur,topptur,fjäll,offpist,randonné,karta,lutning,snö,väder,Kebnekaise,Riksgränsen,Abisko`

**Support-URL:** `https://snolage.se/om-appen`
**Marknadsförings-URL:** `https://snolage.se`
**Integritetspolicy-URL:** `https://snolage.se/om-appen#integritet`
**Copyright:** `2026 Fabian Sund`

### Engelska (Storbritannien)

**Promotional text:**

> Today's avalanche forecast, weather and slope angles on the map – plus tours, observations and your friends' feed. Everything for your next tour in the Swedish mountains.

**Description:**

> Snöläge brings together what you need before a ski tour in the Swedish mountains.
>
> THE AVALANCHE FORECAST
> • Today's official avalanche forecast from the Swedish Environmental Protection Agency for Sweden's six forecast areas
> • Avalanche problems with aspects and elevations, the expected trend and the last few days' danger levels
> • "What does this mean for me?" – plain-language advice for every danger level
> • A notification when the danger level changes in your areas
>
> THE MAP
> • Lantmäteriet's topographic map with slope angle and aspect
> • Plan a route and see its elevation profile, steep terrain and where it crosses what the forecast warns about
> • Save maps and routes to use them without coverage
>
> TOURS AND OBSERVATIONS
> • Tour diary: import workouts with a GPS route from Apple Health, or upload GPX and FIT files
> • Quick observation in the field with big buttons – kept until you have coverage again
> • Follow friends, comment and plan tour days together
>
> WEATHER
> • SMHI's forecast with a wind analysis showing which slopes are likely being loaded
> • Snow depth from SMHI's stations and SMHI's weather warnings
>
> Snöläge is decision support. It does not replace the official avalanche forecast, avalanche training or your own judgement in the field.

**Keywords:**
`backcountry,ski touring,splitboard,sweden,mountains,slope,map,snow,weather,Lapland,Kebnekaise`

### Skärmbilder

Färdiga i mappen `Svenska laviner/app-store/` (1320 × 2868, iPhone 6,9").
Ladda upp `sv-*.png` under svenska och `en-*.png` under engelska, i
nummerordning. Andra iPhone-storlekar behövs inte – Apple skalar ner dem.
Appen är bara för iPhone, så inga iPad-bilder behövs.

## 4. App Privacy (Appens integritet)

Svara **Ja, vi samlar in data**. Kryssa i exakt dessa typer. För **varje** typ:
*Länkad till användaren: Ja*, *Används för spårning: Nej*, syfte:
**Appfunktionalitet** (inget annat).

| Kategori | Typ | Vad det är i Snöläge |
|---|---|---|
| Kontaktuppgifter | E-postadress | inloggning |
| Kontaktuppgifter | Namn | användarnamnet som visas för andra |
| Hälsa och fitness | Fitness | träningspass och rutter från Apple Hälsa (bara om man importerar) |
| Plats | Exakt plats | platsen för observationer och turer |
| Användarinnehåll | Foton eller videor | bilder till observationer och profilbild |
| Användarinnehåll | Annat användarinnehåll | observationer, turer, rutter, kommentarer |
| Identifierare | Användar-ID | kontot |
| Identifierare | Enhets-ID | push-token för notiser |

Det stämmer med appens integritetsmanifest (`ios/App/App/PrivacyInfo.xcprivacy`)
och med integritetspolicyn.

## 5. Åldersgräns

Svara **Nej/Ingen** på allt om våld, sex, droger, spel, skräck m.m. På
frågorna om användargenererat innehåll och kontakt med andra användare:
**Ja** (observationer, kommentarer, profiler). Välj åldersgräns **13+** –
samma som användarvillkoren.

## 6. App Review-information

- **Inloggning krävs:** Ja. Skapa ett konto åt granskarna i appen eller på
  snolage.se med e-post `fabian.n.sund+apple@gmail.com` (Gmail skickar det
  till din vanliga inkorg, så du kan bekräfta adressen). Välj ett eget
  lösenord, användarnamn `App Review`. Skriv e-post och lösenord i fälten
  här – **aldrig i chatten**.
- **Kontakt:** ditt namn, telefon och `fabian.n.sund@gmail.com`.
- **Anteckningar (klistra in):**

> Snöläge shows Sweden's official avalanche forecasts (Swedish Environmental Protection Agency) plus a community of ski tourers. The forecast season runs from December to May, so outside it the areas show "Off season" instead of a danger level – this is intended; the app never shows a danger level that hasn't been officially published.
>
> Demo account: see the sign-in fields. The app switches to English when the phone's language is not Swedish (also under Menu → Language).
>
> User-generated content: every observation, tour, route, comment and profile has a "Report" button; observations and comments are hidden after three reports until an admin reviews them, and the admin is e-mailed. Users can block other users from their profile (Block), which hides each other's content both ways; the list of blocked users is under Profile. Terms of use: https://snolage.se/om-appen#villkor
>
> Account deletion: Profile → "Delete my account" (also https://snolage.se/om-appen#radera-konto).
>
> HealthKit: only read, only when the user taps "Get tours from Apple Health" under Tours – workouts with a GPS route become private tours in the user's tour diary. Optional "Remind me about new ski workouts" uses background delivery to show a local notification. Nothing is written to Health and no health data is used for advertising.
>
> Location: only while in use, for the map position and the place of an observation.

## 7. Skicka in

1. Under **Bygge**, välj det senaste bygget från TestFlight.
2. **Exportregler:** frågan är redan besvarad i appen (ingen egen kryptering).
3. **Lägg till för granskning → Skicka in för granskning.** Granskningen
   tar oftast 1–3 dygn. Avslår Apple något, skicka deras text till Claude.
