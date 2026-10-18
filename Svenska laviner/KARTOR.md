# Kartan direkt från lagringen (kartor.snolage.se)

**Varför:** varje kartbit som gick via workern räknades mot Cloudflares
gratisgräns på 100 000 workeranrop per dygn. En användare som bläddrar runt på
kartan kan dra några hundra kartbitar, så vid en viral video var det kartan som
skulle ta slut först. Kartbitar som hämtas direkt från R2 via en egen adress
räknas inte mot den gränsen, och Cloudflare cachar dem dessutom. R2:s
gratisnivå (10 miljoner läsningar i månaden) räcker långt, och de flesta
läsningar besvaras ur cachen utan att räknas alls.

## Hur det fungerar

- Kartbitarna ligger i en egen R2-hink, **`snolage-kartor`** (EU), som är
  publik på **`https://kartor.snolage.se`**, till exempel
  `https://kartor.snolage.se/topowebb/15/18073/7863.png`.
- **Bara kartbitar får ligga där.** Den gamla hinken `fjallkoll-images` har
  säkerhetskopior och fullständiga GPS-spår och får aldrig göras publik.
- Appen frågar en gång per besök om kartor.snolage.se svarar. Gör den det
  hämtas kartbitarna i fjällen därifrån. Annars, och för kartbitar som inte
  finns där, går det som förut via workern. Kartan fungerar alltså även om
  adressen skulle sluta svara.
- Offlinekartor sparas som förut (under workerns adress), så det som redan
  är sparat på telefoner fungerar fortfarande.
- Workern lägger nya kartbitar (import, säsongsuppdatering, lutningskartan)
  direkt i den nya hinken. Du gör inget annorlunda i KARTBYTE.md eller LUTNING.md.

## Det som sköts automatiskt

- **Deploy-jobbet** skapar hinken och sätter CORS (så att webbsidan och
  apparna får spara kartbitar offline).
- **Jobbet "Kartor direkt från lagringen"** (`.github/workflows/kartor.yml`,
  startas av Claude) flyttar över de ~286 000 kartbitarna från den gamla
  hinken (det tar runt en timme), försöker koppla adressen kartor.snolage.se
  och kontrollerar att den svarar. Det går att köra igen: det som redan är
  flyttat hoppas över.

## Om adressen inte kunde kopplas automatiskt (två minuter)

GitHub-nyckeln får kanske inte ändra domänen snolage.se. Gör då så här:

1. Logga in på <https://dash.cloudflare.com> → **R2 Object Storage**.
2. Klicka på hinken **`snolage-kartor`** → fliken **Settings**.
3. Under **Custom Domains** → **Add**.
4. Skriv `kartor.snolage.se` → **Continue** → **Connect Domain**.
5. Vänta tills status visar **Active** (oftast någon minut).

Klar. Appen börjar använda adressen av sig själv, ingen ny version behövs.
Slå **inte** på "Public Development URL" (r2.dev): den behövs inte.

**Kontroll:** öppna <https://kartor.snolage.se/topowebb/0/0/0.png> i
webbläsaren. Du ska se en liten karta över världen.
