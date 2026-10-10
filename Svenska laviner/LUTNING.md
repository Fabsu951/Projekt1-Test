# Detaljerad lutningskarta (Lantmäteriets höjddata)

Appen har ett nytt kartlager, **"Lutning, detaljerad"**, som visar hur brant
marken är med Lantmäteriets höjdmodell (1 m rutnät) i stället för dagens
grova lager (~30 m). Korta branta partier, skavlar mot raviner och
terrängfällor syns mycket bättre. Lagret dyker upp i **Kartlager → Terräng**
först när kartrutorna är uppladdade.

Färgerna är desamma som i ruttplaneringen: gul 30–35°, orange 35–40°, röd
40–45°, lila över 45°. Under 30° är kartan genomskinlig.

## 1. Ansök om behörighet (en gång)

1. Logga in på <https://geotorget.lantmateriet.se>.
2. Sök efter **Markhöjdmodell Nedladdning, grid 1+**.
3. Beställ som för topokartan (typ **Behörighet**, användning: öppna data för
   en ideell lavinapp). Den är gratis (CC BY 4.0).
4. Vänta tills beställningen står som **Avslutad/Lyckad** (det tog en dag för
   topokartan).

## 2. Provkör (cirka 5 minuter)

I PowerShell:

```powershell
cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
git pull
npm install
powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -DryRun
```

Logga in med Geotorget-kontot när rutan kommer upp. Skriptet:
- listar vad som finns i Lantmäteriets höjd-API och väljer höjdmodellen,
- räknar tre områden och sparar exempelrutor i `worker\slope-prov\`,
- skriver hur lång tid hela importen beräknas ta.

Står det **"Kunde inte välja samling automatiskt"**: kör igen med
`-Collection <id>` och id:t från listan (den som heter något med
Markhöjdmodell grid 1+). Står det **404**: höjddatan ligger i ett annat API
än `stac-hojd`. Skicka utskriften till Claude (den innehåller inga lösenord).

## 3. Importera (några timmar, datorn får användas under tiden)

```powershell
npx wrangler login     # bara om du inte är inloggad
powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -Import
```

Höjdrutorna hämtas en i taget direkt från Lantmäteriet, så inget stort sparas
på datorn. Avbryts det (sömn, nätverk) skriver skriptet vilket område det var
på; fortsätt med `-Import -Skip <nummer>`. Vill du börja med ett område:
`-Import -Box norra` (eller `mitten`, `sodra`).

När det står **"Klart"** syns lagret i appen inom en timme.

## Bra att veta

- Lagret visar terrängen, inte lavinfaran, och appen säger det.
- Lantmäteriet uppdaterar höjdmodellen sällan; ingen säsongsuppdatering behövs.
- Tekniskt: `worker/scripts/fetch-hojd.ps1` → `import-slope.ts` (`dem.ts`
  läser GeoTIFF, `slopeRender.ts` räknar lutning och gör PNG) →
  `POST /admin/tiles/slope` → R2 `maptiles/slope/z/x/y`, zoom 12–15.
