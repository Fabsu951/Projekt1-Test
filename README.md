# Snöläge – lavinprognos, karta och turer för de svenska fjällen

**[snolage.se](https://snolage.se)** · **[App Store](https://apps.apple.com/app/id6834765741)** · Android (testas på Google Play)

Snöläge samlar det en skidturåkare behöver inför en tur i de svenska fjällen: Naturvårdsverkets officiella lavinprognos förklarad i klartext, en topografisk karta med lutning och ruttplanering, väder och snödjup, och en gemenskap med turdagbok, observationer och kompisarnas flöde. Allt är gratis och fungerar även utan täckning.

<p>
  <img src="Svenska%20laviner/app-store/sv-1-idag.png" width="200" alt="Startsidan med dagens läge i dina områden">
  <img src="Svenska%20laviner/app-store/sv-2-omrade.png" width="200" alt="Ett prognosområde med farograd och lavinproblem">
  <img src="Svenska%20laviner/app-store/sv-3-rutt.png" width="200" alt="Ruttplanering med höjdprofil och brant terräng">
  <img src="Svenska%20laviner/app-store/sv-4-tur.png" width="200" alt="En tur i turdagboken">
</p>

*In English: a Swedish avalanche-forecast and ski-touring app – web, iOS and Android from one TypeScript codebase, with a Cloudflare Workers backend.*

## Vad den gör

- **Lavinprognosen:** Naturvårdsverkets prognos via deras öppna API, med lavinproblem (väderstreck, höjder), trend, historik, säsongsöversikt och råd per farograd. Appen visar aldrig en farograd som inte är officiellt publicerad.
- **Kartan:** Lantmäteriets topografiska karta (egen kopia i Cloudflare R2, över en miljon kartbitar) och Kartverkets över Norge, officiella lutningskartor, platssökning bland 38 000 ortnamn, "Hitta åk" (filtrera terräng på lutning och väderstreck), långt tryck för höjd, lutning och väder, offlinekartor.
- **Ruttplanering:** höjdprofil, tidsberäkning (Munter), brant terräng och jämförelse mot dagens lavinproblem, SMHI:s väder på toppen och i botten, export till GPX.
- **Turer och gemenskap:** spela in turer i appen, importera från klockan (GPX/FIT, Apple Hälsa, Health Connect), observationer med varningstecken och foto (köas utan täckning), följ, kommentera, planera turdagar ihop, dela position tillfälligt med kompisar.
- **Säkerhet och integritet:** rapportera/blockera (DSA, App Store-krav), "Var är jag?" med koordinater och 112, integritetspolicy och användarvillkor, all data i EU.

## Teknik

| Del | Teknik |
|---|---|
| App | React 19, TypeScript, Vite, Leaflet, Capacitor (iOS + Android från samma kod) |
| Backend | Cloudflare Workers (TypeScript), D1 (SQLite), R2, cron-jobb |
| Native | Swift och Kotlin för bakgrundsinspelning, positionsdelning och hälsodata |
| Test | Vitest – ca 400 tester i appen och 220 i backend, plus webbläsar- och emulatortester |
| CI/CD | GitHub Actions: varje push testas och driftsätts; Android-APK, signerade iOS-byggen till TestFlight och Play-byggen skapas automatiskt |

Några delar som var roliga att lösa:

- **SQLite över HTTP Range** (`Svenska laviner/worker/scripts/remoteSqlite.ts`): läser Lantmäteriets 150 GB stora GeoPackage direkt från deras server, sida för sida i b-trädet, så att bara fjällområdena hämtades – utan att ladda ner filen.
- **Egen FIT-avkodare** (`Svenska laviner/app/src/utils/fitDecoder.ts`) i stället för Garmins SDK, vars licens inte tillåter spridning; testad mot SDK:n.
- **Web Push utan bibliotek** (`Svenska laviner/worker/src/webpush.ts`): VAPID och aes128gcm med WebCrypto, med en utkorg som respekterar gratisplanens gräns på 50 utgående anrop per körning.
- **Offline först:** service worker för appskalet, sparade API-svar, kartor och rutter i Cache Storage och observationer som skickas när täckningen kommer tillbaka.
- **Terränganalys i webbläsaren:** lutning och väderstreck räknas ut från höjdmodeller (Terrarium-kodade kartbitar) för ruttplanering, "Hitta åk" och långtryck.
- **Svenska och engelska** med en egen liten i18n-lösning där ett test misslyckas om någon text saknar översättning.

## Struktur

```
Svenska laviner/
  app/       React-appen + Capacitor-projekten (ios/, android/)
  worker/    Cloudflare Worker: API, prognoser, kartbitar, notiser
  *.md       Driftanteckningar (kartimport, notiser, appbutiker, backup)
.github/workflows/   Test, driftsättning och appbyggen
```

## Köra lokalt

```bash
cd "Svenska laviner/worker" && npm install && npx wrangler d1 migrations apply fjallkoll --local && npx wrangler dev --local
cd "Svenska laviner/app" && npm install && VITE_MAP_PROXY_URL=http://127.0.0.1:8787 npm run dev
npm test -- --run   # i app/ respektive worker/
```

## Om projektet

Byggt av Fabian Sund som ett eget projekt, med Claude Code som AI-parprogrammerare. Jag har stått för idé, produktbeslut, design och testning i fält; kod och driftsättning har vuxit fram i dialog med AI:n. Data från Naturvårdsverket, SMHI, Lantmäteriet (CC BY 4.0), Kartverket (CC BY 4.0), NVE, Mapterhorn och OpenStreetMap-bidragsgivare (ODbL).

Kontakt: fabian@snolage.se
