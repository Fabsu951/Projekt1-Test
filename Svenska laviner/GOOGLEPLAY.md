# Google Play Console – allt att fylla i

Allt nedan går att klistra in direkt. Teckenantalen är kontrollerade mot
Googles gränser. Bilderna ligger i mappen `Svenska laviner/google-play/`.

Ordningen: **A** nyckel → **B** bygge → **C** skapa appen och ladda upp →
**D** butikssida → **E** "App content"-frågorna → **F** sluten test med 12
testare i 14 dagar → **G** ansök om produktion.

> Klistra aldrig in nyckelfilen (`.jks`), lösenord eller JSON-nycklar i
> chatten med Claude. De ska bara in på GitHub-sidan för hemligheter.

---

## A. Uppladdningsnyckeln (en gång, på datorn)

1. Öppna PowerShell och kör (Java följer med Android Studio):
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$HOME\snolage-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Välj ett starkt lösenord (samma för filen och nyckeln) och svara på
   frågorna (ditt namn räcker, resten kan lämnas tomt med Enter, sist `ja`).
2. **Spara `snolage-upload.jks` och lösenordet säkert** – i en
   lösenordshanterare och en kopia på ett USB-minne. Aldrig i Git.
3. På <https://github.com/Fabsu951/Projekt1-Test/settings/secrets/actions>
   → **New repository secret**, fyra stycken:

   | Name | Secret |
   |---|---|
   | `ANDROID_UPLOAD_KEYSTORE_BASE64` | kör `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\snolage-upload.jks")) \| Set-Clipboard` i PowerShell och klistra in (Ctrl+V) |
   | `ANDROID_UPLOAD_STORE_PASSWORD` | lösenordet |
   | `ANDROID_UPLOAD_KEY_PASSWORD` | lösenordet |
   | `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |

## B. Bygget

Säg till Claude: **"bygg för Play"**. Claude startar "Android-app för Google
Play" (knappen syns inte på GitHub för den här grenen). Efter ca 10 min:
öppna körningen under **Actions**, scrolla längst ner till **Artifacts** och
ladda ner `snolage-1.0.0-…`. Packa upp zip-filen – i den ligger `snolage-1.0.0-<nummer>.aab`.

## C. Skapa appen i Play Console

1. **Skapa app**: namn `Snöläge`, standardspråk **svenska – sv-SE**,
   **App**, **Gratis**, kryssa i deklarationerna → **Skapa app**.
2. **Testa och släpp → Testning → Intern testning → Skapa ny version.**
   - Första gången: välj **Använd Google-genererad signeringsnyckel** (Play
     App Signing). Google håller den riktiga nyckeln; din är bara för
     uppladdning.
   - Ladda upp `.aab`-filen. Versionsnamn fylls i själv.
   - Versionsanteckningar: `Första testversionen.`
   - **Spara → Granska version → Börja lansera till intern testning.**
3. **Testare**: fliken Testare → skapa en e-postlista (din egen Gmail) →
   kopiera **länken för att gå med** och öppna den på telefonen. Avinstallera
   först test-APK:n (den är signerad med en annan nyckel).

## D. Butikssida (Växa → Butiksnärvaro → Huvudbutikssida)

| Fält | Svenska |
|---|---|
| Appnamn (30) | `Snöläge: lavinprognos & turer` |
| Kort beskrivning (80) | `Lavinprognos, väder, karta och turer för skidåkning i de svenska fjällen.` |
| Appikon | `google-play/ikon-512.png` |
| Funktionsbild | `google-play/funktionsbild-1024x500.jpg` |
| Telefonskärmbilder | `google-play/skarmbilder/sv-*.png` (i nummerordning) |

**Fullständig beskrivning:**

> Snöläge samlar det du behöver inför en tur i de svenska fjällen.
>
> LAVINPROGNOSEN
> • Dagens officiella lavinprognos från Naturvårdsverket för Sveriges sex prognosområden
> • Lavinproblemen med väderstreck och höjder, förväntad utveckling och de senaste dagarnas farograder
> • "Vad betyder det för mig?" – råd i klartext för varje farograd
> • Notis när farograden ändras i dina områden
>
> KARTAN
> • Lantmäteriets topografiska karta med lutning och sluttningsriktning
> • Planera en rutt och se höjdprofil, brant terräng och var rutten korsar det prognosen varnar för
> • Spara kartor och rutter för att använda dem utan täckning
>
> TURER OCH OBSERVATIONER
> • Turdagbok: hämta pass med GPS-rutt från Health Connect eller ladda upp GPX- och FIT-filer
> • Snabbobservation i fält med stora knappar – sparas tills du har täckning igen
> • Följ kompisar, kommentera och planera turdagar tillsammans
>
> VÄDER
> • SMHI:s prognos med vindanalys som visar vilka sluttningar som troligen vindlastas
> • Snödjup från SMHI:s stationer och SMHI:s vädervarningar
>
> Snöläge är ett beslutsstöd. Appen ersätter inte den officiella lavinprognosen, en lavinutbildning eller ditt eget omdöme i fält.

**Engelska** (Lägg till översättning → engelska – en-GB): namn
`Snöläge: avalanche & ski tours`, kort beskrivning
`Avalanche forecast, weather, map and tours for ski touring in Swedish mountains`,
skärmbilder `google-play/skarmbilder/en-*.png`, och den engelska
beskrivningen från `APPSTORE.md` med "Apple Health" utbytt mot
"Health Connect".

**Butiksinställningar:** kategori **Sport**, taggar t.ex. *Väder*,
*Kartor*, *Utomhus*. E-post `fabian.n.sund@gmail.com`, webbplats
`https://snolage.se`.

## E. App content (Policy → Appinnehåll)

| Fråga | Svar |
|---|---|
| Integritetspolicy | `https://snolage.se/om-appen#integritet` |
| Appåtkomst | **Vissa funktioner är begränsade** → lägg till instruktion: namn `Granskarkonto`, användarnamn = e-posten, lösenord = lösenordet (skapa kontot på snolage.se med `fabian.n.sund+google@gmail.com` – mejlet kommer till din inkorg, bekräfta det). Text: *"Log in under Profile. Forecasts are published Dec–May; outside the season areas show 'Off season'."* |
| Annonser | **Nej** |
| Innehållsklassificering | Fyll i frågeformuläret: kategori **Referens/nyheter/utbildning** eller **Övrigt**. Våld, sex, svordomar, droger, spel: **nej** på allt. *Kan användare interagera eller utbyta innehåll?* **Ja**. *Delar appen användarens plats med andra?* **Ja** (observationer och turer har en kartpunkt). *Köp i appen:* **nej**. |
| Målgrupp | **13–15, 16–17 och 18+** (samma som villkoren: minst 13 år). Inte riktad till barn. |
| Nyhetsapp | **Nej** |
| Myndighetsapp | **Nej** |
| Finansiella funktioner | **Inga** |
| Hälsa (Health apps) | **Ja** → *Aktivitet och träning* (importerar träningspass med GPS-rutt) |
| Datasäkerhet | Se tabellen nedan |
| Health Connect-behörigheter | Se nedan |

### Datasäkerhet

*Samlar appen in eller delar användardata?* **Ja**. *Krypteras all data
under överföring?* **Ja**. *Kan användare begära att data raderas?* **Ja** –
URL `https://snolage.se/om-appen#radera-konto`.

Kryssa i exakt dessa typer. För **alla**: *Samlas in* ja, *Delas* **nej**,
*Behandlas tillfälligt* nej, syfte **Appfunktioner** (för e-post också
**Kontohantering**).

| Kategori | Typ | Obligatorisk? |
|---|---|---|
| Plats | Ungefärlig plats, Exakt plats | Valfri (bara när man lägger upp något) |
| Personlig information | Namn, E-postadress, Användar-ID | Obligatorisk (konto) |
| Foton och videor | Foton | Valfri |
| Hälsa och träning | Träningsinformation | Valfri (bara vid import) |
| Appaktivitet | Annat användargenererat innehåll | Valfri |
| Enhets-ID eller andra ID | Enhets-ID eller andra ID (push-token) | Valfri |

### Health Connect-behörigheter

Svara att appen läser **Exercise** (`READ_EXERCISE`), **Exercise route**
(`READ_EXERCISE_ROUTE(S)`) och **läsning i bakgrunden**
(`READ_HEALTH_DATA_IN_BACKGROUND`). Motivering att klistra in:

> Snöläge is an avalanche safety and ski touring app. Users can import their
> ski workouts with GPS route from Health Connect into their personal tour
> diary (imported as private tours). Exercise and exercise route are read
> only when the user taps "Get tours from Health Connect". Background read is
> used only if the user turns on "Remind me about new ski workouts": about
> once an hour the app checks for a new ski workout and shows a notification;
> nothing is uploaded until the user imports it. Health data is never sold,
> shared for advertising or used for any other purpose.

Länk till integritetspolicyn som nämner Health Connect:
`https://snolage.se/om-appen#integritet`. Google kan begära en kort video
som visar flödet – säg till Claude om det händer.

## F. Sluten test: 12 testare i 14 dagar

Nya privata utvecklarkonton måste ha **minst 12 testare som är med i en
sluten test i 14 dagar i följd** innan appen får gå ut öppet.

1. **Testning → Sluten testning → Skapa spår** (eller använd "Alpha").
2. Skapa en ny version där med samma `.aab` (eller en nyare).
3. **Testare**: lägg till en e-postlista med minst 12 Gmail-adresser
   (familj, kompisar, skidklubben). Skicka dem länken för att gå med.
4. Be dem installera via länken och öppna appen några gånger under de 14
   dagarna. Räkna med 15–20 personer, några faller alltid bort.

## G. Produktion

Efter 14 dagar: **Instrumentpanel → Ansök om produktionsåtkomst**, svara
på frågorna om testet (vad testarna gjorde, vilken feedback, vad du
ändrade). Sedan **Produktion → Skapa ny version** med senaste `.aab`.
Första granskningen tar ofta några dagar.

Nya versioner därefter: säg till Claude, som bygger en ny `.aab` med högre
versionsnummer.
