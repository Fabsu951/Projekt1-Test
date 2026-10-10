# Det här behöver Fabian göra själv

Allt annat sköter Claude. De här stegen kräver dina inloggningar, din dator
eller din telefon. Gör dem i den här ordningen. Bocka av när du är klar.

> **Viktigt varje gång:** klistra aldrig in lösenord, nycklar eller filer
> (`.json`, `.plist`, `.p8`, `.jks`) i chatten med Claude. De ska bara in på
> GitHub-sidan för hemligheter eller via `wrangler`, så som stegen visar.

**Så öppnar du PowerShell** (behövs i flera steg): tryck på Windows-knappen,
skriv `PowerShell`, tryck Enter. Kopiera en rad i taget härifrån, högerklicka
i PowerShell-fönstret för att klistra in, tryck Enter.

---

## A. Kartbytet – måste vara klart före 31 december ⏰

Lantmäteriets gamla karttjänst stänger 31 december. Då måste kartan finnas
i Snöläges egen lagring. Tar en till några timmar; datorn får användas under
tiden men ska inte somna.

- [ ] **1. Hämta senaste koden och logga in hos Cloudflare.**
  ```powershell
  cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
  git pull
  npm install
  npx wrangler login
  ```
  En webbläsare öppnas – godkänn. (Hänger det sig: stäng och kör
  `npx wrangler login` i ett vanligt PowerShell-fönster, inte i VS Code.)

- [ ] **2. Provkör** (laddar inte upp något, ca 5 minuter):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -DryRun
  ```
  En ruta frågar efter din **Geotorget**-e-post och ditt lösenord (sparas
  aldrig). Det ska stå ungefär **285 000 kartbitar** och **ca 2,8 GB**.
  Står det miljoner eller ett fel: stanna och skicka texten till Claude
  (den innehåller inga lösenord).

- [ ] **3. Importera på riktigt:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -Import
  ```
  Avbryts det (sömn, nätverk) skriver skriptet ut ett tal. Kör då:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -Import -Skip TALET
  ```
  (byt `TALET` mot talet den skrev).

- [ ] **4. Registrera versionen** när det står att importen är klar:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -MarkImported
  ```

- [ ] **5. Kontrollera:** öppna <https://snolage.se/karta>, zooma in på
  Kebnekaise. Kartan ska se ut som vanligt. Säg till Claude att importen är
  gjord.

Mer detaljer: `KARTBYTE.md`. Påminnelse kommer 3 november och 3 februari
om att uppdatera kartan (samma `-Import`-kommando).

---

## B. Testa nya versionen på telefonen (10 minuter)

- [ ] **1.** Öppna Chrome på telefonen och logga in på GitHub.
- [ ] **2.** Gå till
  <https://github.com/Fabsu951/Projekt1-Test/releases/tag/android-senaste>
- [ ] **3.** Tryck **snolage.apk** → **Ladda ner** → öppna filen →
  **Installera** (eller **Uppdatera**).
  - Frågar telefonen om Chrome får installera appar: tillåt.
  - Stoppar Samsungs **Automatisk blockering** det: Inställningar →
    Säkerhet och integritet → Automatisk blockering → av, installera, slå på
    igen.
- [ ] **4.** Prova och notera vad som är konstigt:
  - Ny ikon, nytt utseende, flikraden längst ner.
  - Ljust/mörkt läge (sol/måne i menyn).
  - **Turer → Hämta från klockan**: "Hämta rutten" på ett pass och
    "Påminn mig om nya skidpass".
- [ ] **5.** Skicka det som inte fungerar till Claude (skärmdump går bra).

---

## C. Notiser i Android-appen (5 minuter)

Filen `google-services.json` ligger redan på din dator. GitHub behöver en
kopia för att bygga appen med notiser.

- [ ] **1.** Öppna Utforskaren och gå till
  `C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\app\android\app\`
- [ ] **2.** Högerklicka på **google-services.json** → Öppna med →
  **Anteckningar**. Tryck **Ctrl+A** och sedan **Ctrl+C**.
- [ ] **3.** Gå till
  <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>
  → **New repository secret**.
  - **Name:** `GOOGLE_SERVICES_JSON`
  - **Secret:** klistra in (**Ctrl+V**) → **Add secret**.
- [ ] **4.** Gå till
  <https://github.com/Fabsu951/Projekt1-Test/actions/workflows/android.yml>
  → **Run workflow** → **Run workflow**. Efter ca 10 minuter finns en ny
  APK – installera den som i B.
- [ ] **5.** I appen: stjärnmärk ett område och slå på **"Notis när
  farograden ändras i mina områden"**. Appen frågar om lov – tryck Tillåt.

---

## D. Detaljerad lutningskarta (ansök nu, importera när du fått svar)

- [ ] **1. Ansök:** logga in på <https://geotorget.lantmateriet.se>, sök
  **Markhöjdmodell Nedladdning, grid 1+**, beställ som topokartan (typ
  **Behörighet**, användning: öppna data för en ideell lavinapp). Gratis.
- [ ] **2. Vänta** tills beställningen står som **Lyckad/Avslutad**
  (ungefär en dag).
- [ ] **3. Provkör** i PowerShell:
  ```powershell
  cd "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\worker"
  git pull
  npm install
  powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -DryRun
  ```
  Logga in med Geotorget-kontot. Står det **404** eller **"Kunde inte
  välja samling"**: skicka utskriften till Claude.
- [ ] **4. Importera** (några timmar):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -Import
  ```
  Avbrott: kör `-Import -Skip NUMMER` med numret skriptet skrev.
- [ ] **5.** När det står **Klart**: i appen, **Karta → Kartlager → Terräng
  → "Lutning, detaljerad"**.

Mer detaljer: `LUTNING.md`.

---

## E. Google Play (när du vill ut i butiken)

Kostar 25 USD en gång. Nya privatkonton måste ha **minst 12 testare i 14
dagar** innan appen får publiceras öppet – börja samla familj och kompisar.

- [ ] **1. Skapa utvecklarkonto** på <https://play.google.com/console>
  (välj privatperson, betala, verifiera identiteten – tar några dagar).
- [ ] **2. Skapa uppladdningsnyckeln** i PowerShell:
  ```powershell
  & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$HOME\snolage-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
  ```
  Välj ett starkt lösenord (samma två gånger går bra), svara på frågorna
  (namn räcker). **Spara filen `C:\Users\fabia\snolage-upload.jks` och
  lösenordet** i en lösenordshanterare och på ett USB-minne.
- [ ] **3. Lägg in fyra hemligheter** på
  <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>
  (**New repository secret** för varje):
  | Name | Secret |
  |---|---|
  | `ANDROID_UPLOAD_KEYSTORE_BASE64` | Kör först `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\snolage-upload.jks")) \| Set-Clipboard` i PowerShell, klistra sedan in |
  | `ANDROID_UPLOAD_STORE_PASSWORD` | lösenordet |
  | `ANDROID_UPLOAD_KEY_PASSWORD` | lösenordet |
  | `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |
- [ ] **4. Bygg Play-versionen:** gå till
  <https://github.com/Fabsu951/Projekt1-Test/actions/workflows/android-release.yml>
  → **Run workflow**, skriv `1.0.0` → **Run workflow**. När den är grön:
  öppna körningen, scrolla ner till **Artifacts** och ladda ner filen
  (`.aab`).
- [ ] **5. I Play Console:** **Skapa app** (namn Snöläge, svenska, app,
  gratis) → slå på **Play App Signing** → **Testning → Intern testning →
  Skapa version** → ladda upp `.aab`-filen.
- [ ] **6. Fyll i** butikssidan (texter finns i `APPAR.md` längst ner),
  **Data safety** och **Health Connect-deklarationen** – exakta svar i
  `APPAR.md` § 2 punkt 7–9.
- [ ] **7.** Lägg till dina testare (e-postlista) under **Stängd testning**
  och vänta 14 dagar. Säg till Claude när du vill skicka in för granskning.

---

## F. iPhone (TestFlight, ingen Mac behövs)

Kostar 99 USD per år.

- [ ] **1.** Gå med i **Apple Developer Program** på
  <https://developer.apple.com/programs/enroll/> → **Individual**. Kan ta
  upp till två dygn.
- [ ] **2. Registrera appens id:** <https://developer.apple.com/account> →
  **Certificates, IDs & Profiles → Identifiers → +** → **App IDs → App** →
  Description `Snöläge`, Bundle ID **Explicit** `se.snolage.app`, kryssa i
  **HealthKit** och **Push Notifications** → **Continue → Register**.
- [ ] **3. Skapa appen:** <https://appstoreconnect.apple.com> → **Appar → +
  → Ny app** → iOS, namn `Snöläge`, svenska, bundle-id `se.snolage.app`,
  SKU `snolage`.
- [ ] **4. Nyckel åt GitHub:** App Store Connect → **Användare och åtkomst →
  Integreringar → App Store Connect API → Teamnycklar → +** → namn
  `GitHub Snöläge`, åtkomst **Admin** → ladda ner `.p8`-filen (går bara en
  gång). Skriv upp **Nyckel-ID** och **Utfärdar-ID**.
- [ ] **5. Team ID:** <https://developer.apple.com/account> → **Membership
  details** (tio tecken).
- [ ] **6. Fyra hemligheter** på
  <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>:
  `ASC_KEY_ID` (Nyckel-ID), `ASC_ISSUER_ID` (Utfärdar-ID), `ASC_KEY_P8`
  (öppna `.p8`-filen i Anteckningar, Ctrl+A, Ctrl+C, klistra in),
  `APPLE_TEAM_ID` (Team ID). Radera `.p8`-filen efteråt.
- [ ] **7. Notiser på iPhone:**
  - Firebase (<https://console.firebase.google.com>, projekt
    `snolage-1ce89`) → **Lägg till app → iOS** → bundle-id
    `se.snolage.app` → ladda ner **GoogleService-Info.plist** → öppna i
    Anteckningar → lägg innehållet som hemligheten
    `GOOGLE_SERVICE_INFO_PLIST` på GitHub.
  - Apple Developer → **Certificates, IDs & Profiles → Keys → +** → namn
    `Snöläge APNs`, kryssa i **Apple Push Notifications service** → ladda
    ner `.p8`-filen.
  - Firebase → ⚙️ **Projektinställningar → Cloud Messaging → Apple app
    configuration** → ladda upp den `.p8`-filen med **Key ID** och
    **Team ID**. Radera filen efteråt.
- [ ] **8. Säg till Claude**, som startar ett iPhone-bygge (ca 30 minuter).
- [ ] **9.** App Store Connect → **TestFlight → Intern testning → +** →
  lägg till dig själv. Installera **TestFlight** från App Store på
  iPhonen, logga in med samma Apple-ID, tryck **Installera** vid Snöläge.

---

## G. Små kontroller (lägg i kalendern)

- [ ] **Måndag 12 oktober, på eftermiddagen:** Snöläge → profilen → **Översikt**. Det ska
  stå "Senaste säkerhetskopian: …". Står det "Ingen säkerhetskopia än": säg
  till Claude.
- [ ] **Någon gång när SMHI har en vädervarning i fjällen:** öppna
  <https://fjallkoll-worker.fabian-n-sund.workers.dev/warnings> och skicka
  en skärmdump till Claude.
- [ ] **16 december** (du får en påminnelse och ett mejl): jämför
  farograden i Snöläge med <https://www.lavinprognoser.se> för några
  områden.
- [ ] **3 november och 3 februari** (påminnelse kommer): uppdatera kartan,
  steg A3 igen.

---

## H. Valfritt

- [ ] **Jurist:** låt en jurist läsa villkoren och integritetspolicyn
  (<https://snolage.se/om-appen#villkor>). Frågorna att ta med finns i
  `JURIDIK.md`.
- [ ] **Städa i Cloudflare:** <https://dash.cloudflare.com> → **Workers &
  Pages** → öppna **fjallvarning** → **Settings** → längst ner **Delete**.
  Gör samma sak med **fjallvarning-worker**. (Rör inte `fjallkoll` eller
  `fjallkoll-worker` – det är den riktiga appen.)
