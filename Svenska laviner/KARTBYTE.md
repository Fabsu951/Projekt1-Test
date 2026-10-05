# Kartbyte före 31 december 2026

Lantmäteriet stänger "Topografisk webbkarta Visning, översiktlig" (kartan
Turkoll använt hittills) den **31 december 2026**. Ersättaren är den
kostnadsfria (CC0) produkten **Topografisk webbkarta Nedladdning, raster**,
som vi laddar ner en gång och lagrar själva i Cloudflare R2.

Sajten använder redan den nya kartadressen. Tills importen är gjord hämtar
workern saknade kartbitar från den gamla tjänsten (och sparar dem), så inget
syns förändrat för användarna.

## 1. Beställ på Geotorget

1. Logga in på <https://geotorget.lantmateriet.se> och öppna produkten
   **Topografisk webbkarta Nedladdning, raster**.
2. Välj **Web Mercator (EPSG:3857)** – inte SWEREF 99 TM.
3. Välj den **färglagda** kartan (inte "nedtonad"), om du får välja.
4. Upplösning: den högsta som erbjuds (1,2 m/pixel). Importen tar bara med
   zoom 0–15, resten hoppas över.
5. Område: rita eller ange tre rutor. Koordinaterna ska anges i
   **SWEREF 99 TM** (även om kartan beställs i Web Mercator):

   | Ruta | Öst (E) | Norr (N) |
   |---|---|---|
   | Norra: Kebnekaise + Abisko/Riksgränsen | 581 000 – 722 000 | 7 494 000 – 7 619 000 |
   | Mitten: Västra Vindelfjällen + Södra Lapplandsfjällen | 447 000 – 562 000 | 7 181 000 – 7 354 000 |
   | Södra: Södra Jämtland + Västra Härjedalen | 338 000 – 456 000 | 6 896 000 – 7 085 000 |

6. Ladda ner alla GeoPackage-filer (`.gpkg`) till en mapp, t.ex.
   `C:\Users\fabia\Downloads\topowebb`.

Uppskattning: runt 270 000 kartbitar, ca 7 GB (ryms i R2:s gratisnivå på 10 GB).

## 2. Importera

I PowerShell, där du är inloggad med `npx wrangler login`:

```powershell
git -C C:\Users\fabia\Documents\fjallvarning-repo pull
powershell -ExecutionPolicy Bypass -File "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\deploy.ps1"
cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
npx tsx scripts/import-tiles.ts --dry-run (Get-ChildItem C:\Users\fabia\Downloads\topowebb\*.gpkg).FullName
npx tsx scripts/import-tiles.ts (Get-ChildItem C:\Users\fabia\Downloads\topowebb\*.gpkg).FullName
```

- `--dry-run` räknar bara och visar vilken tabell och vilka zoomnivåer som
  används – kontrollera att det står 0–15 (eller en del av dem).
- Den riktiga körningen skapar en engångsnyckel på workern och laddar upp i
  buntar. Räkna med en till några timmar. Avbryts den går det bra att köra
  om – kartbitar skrivs bara över.
- Kräver Node.js 22.13 eller senare (skriptet säger till annars).

## 3. Efter importen

Kartan kommer nu från vår egen lagring. Lantmäteriet uppdaterar produkten
var tredje månad; kör om steg 1–2 någon gång per säsong för att få med
ändringar (nya leder, stugor m.m.).
