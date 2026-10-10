# Notiser i mobilapparna (Firebase)

Webbläsaren får redan notiser (web push). Android- och iPhone-appen får dem
via **Firebase Cloud Messaging** (FCM). Till iPhone skickar Firebase vidare
via Apples push-tjänst (APNs). Koden är klar. Det här är engångsstegen som
bara du kan göra, eftersom de kräver dina konton.

Så länge stegen inte är gjorda syns notisvalen inte i apparna, och inget går
sönder.

**Klistra aldrig in nycklar, JSON-filer eller lösenord i chatten.**

## 1. Skapa Firebase-projektet (gratis)

1. Gå till <https://console.firebase.google.com> och logga in med ditt
   Google-konto.
2. **Skapa ett projekt** med namnet `Snöläge`. **Stäng av Google Analytics**,
   det behövs inte.

## 2. Android

1. Välj **Lägg till app → Android** i projektet.
2. **Android-paketnamn:** `se.snolage.app`. Smeknamn: `Snöläge Android`.
   SHA-1 behövs inte.
3. Ladda ner **`google-services.json`** och lägg den i
   `Svenska laviner\app\android\app\` (bredvid `build.gradle`).
   Filen är inte hemlig och kan checkas in.
4. Hoppa över stegen om att lägga till SDK:n. Det är redan gjort.
5. Bygg och kör appen som vanligt (`npm run app:android`).

## 3. iPhone (kräver Apple-utvecklarkonto, men ingen Mac)

Gör först APPAR.md § 3 (utvecklarkonto och TestFlight).

1. Välj **Lägg till app → iOS** i Firebase. **Bundle-id:** `se.snolage.app`.
2. Ladda ner **`GoogleService-Info.plist`**. Öppna den i Anteckningar och
   lägg hela innehållet som GitHub-hemligheten **`GOOGLE_SERVICE_INFO_PLIST`**
   på <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>.
   Hoppa över Firebase-stegen om att lägga till SDK:n. Det är redan gjort.
3. Gå till Apple Developer → **Certificates, IDs & Profiles → Keys → +**:
   - Namn: `Snöläge APNs`
   - Kryssa i **Apple Push Notifications service (APNs)**
   - Skapa och ladda ner `.p8`-filen. Den går bara att ladda ner en gång.
4. Gå till Firebase → ⚙️ **Projektinställningar → Cloud Messaging → Apple
   app configuration**. Ladda upp `.p8`-filen med **Key ID** och **Team ID**.
   Radera filen från datorn efteråt.
5. Push-behörigheten och "Remote notifications" finns redan i projektet.
   Nästa iPhone-bygge på GitHub får med push.

## 4. Låt workern skicka (görs en gång)

1. Gå till Firebase → ⚙️ **Projektinställningar → Tjänstkonton → Generera ny
   privat nyckel**. Du får en `.json`-fil. **Den är hemlig.**
2. I PowerShell:

   ```powershell
   cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
   Get-Content "C:\Users\fabia\Downloads\<filnamnet>.json" -Raw | npx wrangler secret put FCM_SERVICE_ACCOUNT
   ```

3. **Radera `.json`-filen** efteråt, och töm papperskorgen.
4. Kör `deploy.ps1`. Den skapar också databastabellen `native_devices`.
5. Kontrollera att
   <https://fjallkoll-worker.fabian-n-sund.workers.dev/native/status>
   svarar `{"enabled":true}`.

## 5. Testa

- **Startsidan "Idag" → "Notis när farograden ändras i mina områden"**
  (stjärnmärk minst ett område först). Appen frågar om lov att visa notiser.
- **Notiser (klockan) → "Skicka notiserna till den här enheten"** ger
  notiser om följare, kommentarer och gilla.
- Testnotis: Firebase → **Messaging → Ny kampanj → Notifications → Skicka
  testmeddelande**. Klistra in telefonens token. Den syns i Android Studios
  Logcat om du söker på `FirebaseMessaging`.

## Hur det fungerar

- `worker/src/fcm.ts`: loggar in som tjänstkontot (signerad JWT → token
  som gäller en timme) och skickar via FCM HTTP v1. Döda token tas bort
  automatiskt.
- `worker/src/nativePush.ts`: `/native/register`, `/native/unregister`,
  `/native/status`. Farogradsändringar går till enheter som följer området.
  Konto-notiser går bara till enheter där du slagit på dem medan du var
  inloggad.
- `app/src/services/nativePush.ts`: samma två val som i webbläsaren.
  Telefonen kommer ihåg vad den bett om och skickar om det när Firebase byter
  token. Utloggning stänger av konto-notiserna på telefonen. Ett tryck på en
  notis öppnar rätt sida i appen.
