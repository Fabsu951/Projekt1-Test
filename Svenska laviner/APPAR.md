# Snöläge som mobilapp

Snöläge är byggt med Capacitor: samma kod som hemsidan körs i en app för
Android och iPhone. Den här guiden visar hur du bygger apparna, testar dem på
din egen telefon och lägger ut dem i Google Play och App Store.

## Vad som är förberett

- **Ikon och startbild** med Snöläges logga, i alla storlekar för Android och
  iPhone. Ritas om med `npm run app:icons` om bilderna i `app/assets/` ändras.
- **Notch, statusfält och gestfält:** sidan lämnar plats för dem, även i
  helskärmskartan.
- **Androids bakåtknapp** går tillbaka en sida i appen och stänger den först
  från startsidan.
- **Delningslänkar** till rutter pekar på `fjallkoll.pages.dev` även i appen.
- **"Spara som GPX"** öppnar telefonens dela-meny i appen, så att filen kan
  skickas till klockans app, Filer, mejl och så vidare.
- **Kamera och bilder:** bildfälten kan ta ett foto direkt. Behörighetstexter
  finns för iPhone.
- **Plats** används för "Visa min position", närmaste område och observationer.
- **Adresser:** appen hämtar allt från workern, och adressen är inbyggd via
  `app/.env.production`.
- **Radera konto:** en egen sida för butikernas krav finns på
  `https://snolage.se/om-appen#radera-konto`.

- **Health Connect (Android) och Apple Hälsa (iPhone):** hämtar pass med
  GPS-spår från klockans app som privata turer. Med "Lägg till nya skidpass
  automatiskt" sker det varje gång appen öppnas eller kommer tillbaka i
  förgrunden. Kräver Android 8 eller senare.
- **Push-notiser** (farograd i dina områden och notiser för ditt konto) via
  Firebase. Koden är klar, men den kräver engångsstegen i `NOTISER.md`.

**Inte byggt än:** import av pass *i bakgrunden* när appen är stängd. Det
kräver inbyggd Android-kod (WorkManager) och iOS-kod (HKObserverQuery) som
måste kompileras och testas på riktiga telefoner. Det görs bäst tillsammans
med Claude när du sitter med Android Studio eller Xcode.

## App-id

Appens id är `se.snolage.app` (bytt 2026-10-05, före första publiceringen).
Det går **aldrig** att ändra efter att appen finns i Google Play eller App
Store, så låt det vara som det är. Har du redan en testversion med det gamla
id:t (`com.fabsu951.projekt1`) på telefonen blir den nya en separat app:
avinstallera den gamla.

## 1. Testa på din Android-telefon

Du behöver [Android Studio](https://developer.android.com/studio). Installera
det med standardinställningarna.

```powershell
cd C:\Users\fabia\Documents\fjallvarning-repo
git pull
cd "Svenska laviner\app"
npm install
npm run app:android
```

Kommandot bygger sajten, kopierar in den i Android-projektet och öppnar
Android Studio.

1. På telefonen: Inställningar → Om telefonen → tryck sju gånger på
   **Build-nummer**. Då blir du "utvecklare".
2. Inställningar → System → Utvecklaralternativ → slå på **USB-felsökning**.
3. Anslut telefonen med USB och godkänn datorn på telefonen.
4. I Android Studio: välj telefonen överst och tryck på den gröna
   ▶-knappen. Appen installeras och startar.

Kör `npm run app:android` igen varje gång koden har ändrats.

**Första gången (så gick det 7 oktober 2026):**

- "Gradle JVM version 25 is incompatible" → klicka **Use JVM 21**.
- "Please provide the path to the Android SDK" → Cancel, sedan File →
  Settings → Languages & Frameworks → Android SDK. Kryssa i **Android 16.0
  ("Baklava"), API 36.0** under SDK Platforms och **Command-line Tools** under
  SDK Tools → Apply.
- Hittar Gradle ändå inte SDK:t, skapa `android\local.properties` (finns inte
  i git):

  ```powershell
  Set-Content -Path "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\app\android\local.properties" -Value "sdk.dir=C:/Users/fabia/AppData/Local/Android/Sdk" -Encoding ascii
  ```

  och kör File → Sync Project with Gradle Files.
- På Samsung heter Build-nummer **Kompileringsnr** (Om telefonen →
  Programvaruinformation).
- Uppgradera inte AGP/Gradle/Kotlin när Android Studio föreslår det.

## Ny version utan dator

GitHub bygger en ny testversion av Android-appen varje gång appens kod
ändras (`.github/workflows/android.yml`, tar cirka 10 minuter).

1. Öppna på telefonen, i Chrome och inloggad på GitHub:
   <https://github.com/Fabsu951/Projekt1-Test/releases/tag/android-senaste>
2. Tryck på **snolage.apk** → **Ladda ner** → öppna filen → **Installera**.
3. Första gången frågar telefonen om Chrome får installera appar: tillåt det
   (Inställningar → Appar → Chrome → Installera okända appar). Om Samsung säger
   att **Automatisk blockering** stoppar installationen: Inställningar →
   Säkerhet och integritet → Automatisk blockering → av, installera, slå på
   igen.
4. **Bara första gången:** avinstallera den gamla appen först. Den byggdes med
   en annan nyckel på datorn, så den nya kan inte ersätta den. Därefter
   ersätter varje ny version den förra, och inloggning och sparade kartor
   finns kvar. Android Studio använder samma nyckel
   (`android/app/snolage-debug.keystore`), så båda sätten fungerar om vartannat.

Notiser i appen kräver att innehållet i `google-services.json` ligger som
hemlighet `GOOGLE_SERVICES_JSON` på
<https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>
(**New repository secret**, klistra in hela filens innehåll). Utan den
fungerar allt utom notiserna. Klistra aldrig in den i chatten.

## 2. Google Play

1. Skapa ett utvecklarkonto på
   [play.google.com/console](https://play.google.com/console). Det kostar 25 USD
   en gång. Som privatperson måste nya konton låta minst 12 testare prova appen
   i 14 dagar innan den kan publiceras öppet, till exempel familj och kompisar.
2. **Skapa uppladdningsnyckeln (en gång, på din dator):** öppna PowerShell och
   kör (Java följer med Android Studio):
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$HOME\snolage-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Välj ett starkt lösenord (samma för filen och nyckeln går bra) och svara på
   frågorna (namn räcker). **Spara filen `snolage-upload.jks` och lösenordet
   säkert**, till exempel i en lösenordshanterare och en kopia på ett
   USB-minne. Lägg dem aldrig i Git och klistra aldrig in dem i en chatt –
   inte heller här.
3. **Lägg nyckeln på GitHub** (Settings → Secrets and variables → Actions →
   New repository secret), fyra secrets:
   - `ANDROID_UPLOAD_KEYSTORE_BASE64` – filen som text. Ta fram den med
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\snolage-upload.jks")) | Set-Clipboard`
     och klistra in direkt i GitHub-rutan.
   - `ANDROID_UPLOAD_STORE_PASSWORD` och `ANDROID_UPLOAD_KEY_PASSWORD` – lösenordet.
   - `ANDROID_UPLOAD_KEY_ALIAS` – `upload`.
4. **Bygg appen för Play:** Actions → "Android-app för Google Play" → Run
   workflow, skriv versionsnamnet (t.ex. `1.0.0`). När körningen är klar finns
   `.aab`-filen under **Artifacts** längst ner på körningens sida.
5. **Första uppladdningen gör du själv:** i Play Console skapar du appen
   (`se.snolage.app`), slår på **Play App Signing** (Google håller den riktiga
   signeringsnyckeln, din nyckel är bara för uppladdning – tappar du den kan
   Google byta den) och laddar upp `.aab`-filen under Testing → Internal
   testing. Fyll i butikssidan med texterna nedan.
6. **Valfritt, uppladdning direkt från GitHub:** skapa ett tjänstekonto i
   Google Cloud med åtkomst till appen i Play Console (Users and permissions →
   bjud in tjänstekontots e-post, "Release to testing tracks") och lägg hela
   JSON-nyckeln som secret `PLAY_SERVICE_ACCOUNT_JSON`. Kryssa sedan i "Ladda
   upp till intern testning" när du kör workflowen.
   Testversionen från "Android-app" (snolage.apk) är signerad med en
   testnyckel och kan aldrig laddas upp till Play.
7. **Dataskydd ("Data safety")**, svara så här:
   - Samlar in: e-post, namn (användarnamn), ungefärlig och exakt plats (bara
     när användaren själv lägger upp en observation, tur eller rutt), foton,
     användargenererat innehåll (observationer, turer, kommentarer).
   - Delas inte med tredje part för reklam. Krypteras under överföring.
     Användare kan begära radering: ange
     `https://snolage.se/om-appen#radera-konto`.
8. **Health Connect:** appen kan hämta träningspass med GPS-rutt från Health
   Connect (sidan "Hämta från Health Connect" under Turer). Google kräver då
   en deklaration i Play Console under **App content → Health apps / Health
   Connect permissions**: ange att appen läser **Exercise** och **Exercise
   route**, för att användaren ska kunna importera sina skidturer till
   turdagboken, att datan bara läses när användaren ber om det och att inget
   säljs eller används för reklam. Appen ber också om **läsning i bakgrunden**
   (`READ_HEALTH_DATA_IN_BACKGROUND`) för "Påminn mig om nya skidpass": en
   koll ungefär en gång i timmen som bara visar en notis, påslagen av
   användaren, och som inte skickar något från telefonen. Lägg också till "Health and fitness" i
   Data safety. Granskningen kan ta några dagar extra.
9. **Integritetspolicy:** `https://snolage.se/om-appen#integritet`

## 3. iPhone (TestFlight och App Store, utan egen Mac)

GitHub bygger iPhone-appen på sina Mac-datorer (`.github/workflows/ios.yml`)
varje gång iPhone-koden ändras. HealthKit, bakgrundsleverans från Apple Hälsa
och push är redan inlagda i Xcode-projektet (`ios/App/App/App.entitlements`).
För att appen ska komma in på din iPhone krävs Apples testapp **TestFlight**,
och för den behövs ett utvecklarkonto. Gör så här en gång:

1. **Gå med i Apple Developer Program** (99 USD per år) på
   <https://developer.apple.com/programs/enroll/>. Logga in med ditt Apple-ID
   och välj **Individual**. Det kan ta upp till två dygn innan kontot är
   godkänt.
2. **Registrera appens id.** På <https://developer.apple.com/account> →
   **Certificates, IDs & Profiles → Identifiers → +** → **App IDs → App**:
   - Description: `Snöläge`
   - Bundle ID: **Explicit**, `se.snolage.app`
   - Kryssa i **HealthKit** och **Push Notifications** → **Continue → Register**.
3. **Skapa appen i App Store Connect.** <https://appstoreconnect.apple.com> →
   **Appar → + → Ny app**: plattform iOS, namn `Snöläge`, språk svenska,
   bundle-id `se.snolage.app`, SKU `snolage`. Du behöver inte fylla i något
   mer just nu.
4. **Skapa en nyckel åt GitHub.** App Store Connect → **Användare och åtkomst →
   Integreringar → App Store Connect API → Teamnycklar → +**: namn
   `GitHub Snöläge`, åtkomst **Admin** (krävs för att GitHub ska kunna signera
   appen). Ladda ner `.p8`-filen. Den går bara att ladda ner en gång. Skriv upp
   **Nyckel-ID** och **Utfärdar-ID** (Issuer ID) som står på sidan.
5. **Ditt Team ID** står på <https://developer.apple.com/account> under
   **Membership details** (tio tecken, till exempel `AB12CD34EF`).
6. **Lägg in fyra hemligheter på GitHub:**
   <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions> →
   **New repository secret**, en i taget:

   | Name | Secret |
   |---|---|
   | `ASC_KEY_ID` | Nyckel-ID från steg 4 |
   | `ASC_ISSUER_ID` | Utfärdar-ID från steg 4 |
   | `ASC_KEY_P8` | Hela innehållet i `.p8`-filen (öppna den i Anteckningar) |
   | `APPLE_TEAM_ID` | Team ID från steg 5 |

   Radera `.p8`-filen från datorn efteråt. **Klistra aldrig in den i chatten.**
7. **Säg till Claude**, som startar ett bygge. Efter cirka 30 minuter finns
   appen i App Store Connect under **TestFlight**. Lägg till dig själv under
   **Intern testning → +** (grupp `Jag`, kryssa i automatisk distribution).
8. **Installera TestFlight** från App Store på iPhonen, logga in med samma
   Apple-ID och tryck **Installera** vid Snöläge. Nya versioner kommer sedan
   automatiskt i TestFlight.

Push på iPhone kräver dessutom stegen i `NOTISER.md` § 3.

När appen ska ut i App Store: fyll i butikssidan och integritetsfrågorna i App
Store Connect med samma svar som för Google Play. Under **App Privacy** anger
du dessutom **Health & Fitness → Fitness** (bara träningspass och rutter,
kopplat till användaren, används för appens funktion, inte för spårning).
Apple granskar HealthKit-appar extra noga och kräver att integritetspolicyn
nämner Apple Hälsa. Det gör den redan.

Har du en Mac kan du också bygga själv: `npm run app:ios` öppnar Xcode, välj
ditt team under **Signing & Capabilities** och kör på telefonen.

## Butikstexter (förslag)

**Namn:** Snöläge – lavinprognos och turer

**Kort beskrivning (80 tecken):**
Lavinprognos, väder, karta och turer för skidåkning i svenska fjällen.

**Lång beskrivning:**
Snöläge samlar det du behöver inför en tur i de svenska fjällen:

• Dagens lavinprognos från Naturvårdsverkets lavinprognoser.se, med
  lavinproblem, väderstreck och höjder
• Väderprognos och vindanalys från SMHI: vilka sluttningar som troligen är
  vindlastade
• Topografisk karta med terränglutning, din position och kartor du kan spara
  för användning utan täckning
• Ruttplanering med höjdprofil, lutning och jämförelse med dagens prognos
• Turdagbok: ladda upp GPX- eller FIT-filer från klockan och dela med andra
• Observationer från andra åkare, ett flöde med kompisarnas turer, kommentarer
  och notiser
• Säkerhetsguide om lavinterräng, lavinskalan och vad du ska ha med dig

Snöläge ersätter inte den officiella lavinprognosen, en lavinutbildning eller
ditt eget omdöme i fält.

**Kategori:** Sport (alternativt Väder)

**Skärmbilder:** ta 4–8 stycken från telefonen, till exempel ett område med
prognos, kartan med en planerad rutt, flödet och en tur.
