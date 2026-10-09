# Automatisk publicering (utan VS Code)

När Claude pushar ändringar till grenen `claude/bold-lamport-juktha` (eller
`svenska-laviner`) publicerar GitHub allt automatiskt:

1. kör alla tester (stoppar om något fel finns, då publiceras ingenting)
2. uppdaterar databasen
3. publicerar workern
4. bygger och publicerar sajten på snolage.se

Det enda som behövs är en nyckel från Cloudflare som bara GitHub känner till.
Det gör du en gång, och det går bra från telefonen.

**Klistra aldrig in nyckeln i chatten.** Den ska bara in i GitHub.

## 1. Skapa nyckeln i Cloudflare

1. Gå till <https://dash.cloudflare.com/profile/api-tokens> → **Create Token**.
2. Längst ner: **Custom token → Get started**.
3. **Token name:** `GitHub deploy Snöläge`.
4. **Permissions** (klicka **+ Add more** mellan varje):

   | Första rutan | Andra rutan | Tredje rutan |
   |---|---|---|
   | Account | Workers Scripts | Edit |
   | Account | D1 | Edit |
   | Account | Cloudflare Pages | Edit |
   | Account | Workers R2 Storage | Edit |
   | Account | Account Settings | Read |
   | User | User Details | Read |

5. **Account Resources:** Include → ditt konto (Fabian.n.sund@…).
6. **Client IP Address Filtering** och **TTL:** låt vara tomma.
7. **Continue to summary → Create Token.** Kopiera nyckeln. Den visas bara en
   gång.

## 2. Lägg nyckeln i GitHub

1. Gå till <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>.
2. **New repository secret.**
3. **Name:** `CLOUDFLARE_API_TOKEN`
4. **Secret:** klistra in nyckeln → **Add secret**.

Säg sedan till Claude att det är klart. Claude startar den första publiceringen.

## Se hur det gick

<https://github.com/Fabsu951/Projekt1-Test/actions> visar varje publicering:
grön bock = publicerad, rött kryss = något stoppade (då publicerades
ingenting, och Claude kan läsa felet och rätta det).

## Om nyckeln läcker

Radera den under Cloudflare → My Profile → API Tokens, skapa en ny enligt
steg 1 och byt värdet i GitHub (steg 2, **Update**).

## Fortfarande på datorn

- Android- och iPhone-apparna byggs i Android Studio / Xcode.
- `deploy.ps1` fungerar som förut om du någon gång vill publicera själv.
