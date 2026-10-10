# Säkerhetskopior av databasen

Databasen (konton, observationer, turer, rutter, kommentarer, notiser …)
finns hos Cloudflare (D1, lagrad inom EU). Den skyddas på två sätt:

1. **Cloudflares egen återställning (D1 Time Travel):** Cloudflare kan
   återställa databasen till vilken minut som helst de senaste 30 dagarna.
   Det här är förstahandsvalet om något går fel.
2. **Snöläges veckokopia:** varje måndag natt (02:37 UTC) sparar servern en
   komprimerad kopia i R2-lagringen `fjallkoll-images` under
   `backups/d1/<datum>.json.gz`. Kopior äldre än 28 dagar tas bort
   automatiskt (integritetspolicyn lovar högst 30 dagar). Inloggningar,
   e-postlänkar och spärrräknare sparas inte – efter en återställning loggar
   alla bara in igen. Senaste kopian syns på Översikt (adminsidan). Misslyckas
   den får administratörerna ett mejl.

Säg till Claude om något behöver återställas – stegen nedan är för säkerhets
skull. Kör dem i PowerShell i mappen `Svenska laviner\worker`.

## Återställa med Time Travel (enklast)

```powershell
npx wrangler d1 time-travel info fjallkoll
npx wrangler d1 time-travel restore fjallkoll --timestamp=2026-12-20T08:00:00Z
```

Välj en tidpunkt strax innan felet. Det som hänt efter den tidpunkten
försvinner.

## Återställa från veckokopian

1. Hämta kopian (byt datum):
   ```powershell
   npx wrangler r2 object get fjallkoll-images/backups/d1/2026-12-14.json.gz --file backup.json.gz --jurisdiction eu --remote
   ```
2. Gör om den till SQL:
   ```powershell
   npx tsx scripts/restore-backup.ts backup.json.gz > restore.sql
   ```
   Skriptet säger hur många rader kopian har och vilken migrering databasen
   ska ha.
3. Databasen måste vara **tom men migrerad**. Enklast är en ny databas:
   ```powershell
   npx wrangler d1 create fjallkoll-aterstalld --jurisdiction eu
   ```
   lägg dess `database_id` i `wrangler.toml` (i stället för den gamla), och kör
   ```powershell
   npx wrangler d1 migrations apply fjallkoll-aterstalld --remote
   npx wrangler d1 execute fjallkoll-aterstalld --remote --file restore.sql
   npx wrangler deploy
   ```
4. Radera `backup.json.gz` och `restore.sql` från datorn efteråt – de
   innehåller personuppgifter.
