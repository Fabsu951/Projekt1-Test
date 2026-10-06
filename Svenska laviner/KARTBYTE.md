# Kartbyte före 31 december 2026

Lantmäteriet stänger "Topografisk webbkarta Visning, översiktlig" (kartan
Snöläge använt hittills) den **31 december 2026**. Ersättaren är den
kostnadsfria produkten (licens CC BY 4.0: ange "©Lantmäteriet", datakällan och licensen) **Topografisk webbkarta Nedladdning, raster**,
som vi laddar ner en gång och lagrar själva i Cloudflare R2.

Sajten använder redan den nya kartadressen. Tills importen är gjord hämtar
workern saknade kartbitar från den gamla tjänsten (och sparar dem), så inget
syns förändrat för användarna.

## 1. Beställ på Geotorget och hämta filerna

1. **Klart 2026-10-06:** produkten är beställd på Geotorget (ärende
   LM2026/152399, "Behörighet", status Lyckad). Den levereras inte som en
   nedladdningslänk utan via Lantmäteriets STAC-API
   (`https://api.lantmateriet.se/stac-karta/v1`), med Geotorget-inloggningen.
2. Visa vad som finns (hämtar inget):

   ```powershell
   cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
   powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1
   ```

   En inloggningsruta frågar efter Geotorget-e-post och lösenord (sparas
   aldrig). Samlingen `topowebb` har **en fil per variant för hela
   Sverige** (ca 130–160 GB styck); skriptet väljer `topowebb-3857.gpkg`
   (färg, Web Mercator, 145,5 GB) och kollar att servern stöder
   delhämtning (HTTP Range: ja, 2026-10-06).
3. **Ingen nedladdning behövs.** Importen läser bara de delar av filen
   som innehåller fjällrutorna, direkt från Lantmäteriet:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -DryRun   # provkörning, laddar inte upp
   powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -Import   # på riktigt (kräver npx wrangler login)
   ```

   Provkörningen visar antal kartbitar per zoom, ett stickprov och
   uppskattad storlek. Den riktiga körningen hämtar ca 7 GB i stora block
   (ungefär ett anrop per tolv kartbitar) och laddar upp till R2.
   Avbryts den skriver den ut `--skip <n>`; kör då
   `npx tsx scripts/import-tiles.ts --skip <n> <adressen>` – eller bara
   `-Import` igen (allt skrivs över, det tar bara längre).
4. Alternativ om delhämtning slutar fungera: `-Download` (eller
   `-Download -OutDir E:\topowebb` om C: har för lite plats – filen är
   145,5 GB) och sedan importen från filen enligt avsnitt 2.

Rutorna (SWEREF 99 TM; i skriptet omräknade till WGS84):

| Ruta | Öst (E) | Norr (N) |
|---|---|---|
| Norra: Kebnekaise + Abisko/Riksgränsen | 581 000 – 722 000 | 7 494 000 – 7 619 000 |
| Mitten: Västra Vindelfjällen + Södra Lapplandsfjällen | 447 000 – 562 000 | 7 181 000 – 7 354 000 |
| Södra: Södra Jämtland + Västra Härjedalen | 338 000 – 456 000 | 6 896 000 – 7 085 000 |

Importen läser bara rutorna ovan ur den stora filen (plus hela Sverige
upp till zoom 7): runt 270 000 kartbitar i zoom 8–15, ca 7 GB i R2 (ryms i
gratisnivån på 10 GB). `--all` tar med hela filen (ryms inte gratis).

Villkor: CC BY 4.0. Ange "©Lantmäteriet", datakällan och licensen (görs på
kartan och på Om-sidan).

## 2. Importera

I PowerShell, där du är inloggad med `npx wrangler login`:

```powershell
git -C C:\Users\fabia\Documents\fjallvarning-repo pull
powershell -ExecutionPolicy Bypass -File "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\deploy.ps1"
cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
npx tsx scripts/import-tiles.ts --dry-run C:\Users\fabia\Downloads\topowebb\topowebb-3857.gpkg
npx tsx scripts/import-tiles.ts C:\Users\fabia\Downloads\topowebb\topowebb-3857.gpkg
```

- `--dry-run` räknar bara och visar tabell, zoomnivåer (ska vara 0–15) och
  område. Räkna med runt 270 000 kartbitar; är det miljoner, avbryt.
- Den riktiga körningen skapar en engångsnyckel på workern och laddar upp i
  buntar. Räkna med en till några timmar. Avbryts den går det bra att köra
  om – kartbitar skrivs bara över.
- Kräver Node.js 22.13 eller senare (skriptet säger till annars).

## 3. Efter importen

Kartan kommer nu från vår egen lagring. Lantmäteriet uppdaterar produkten
var tredje månad; kör om steg 1–2 någon gång per säsong för att få med
ändringar (nya leder, stugor m.m.).
