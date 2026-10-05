# Fjällkoll som mobilapp

Fjällkoll är byggt med Capacitor: samma kod som hemsidan körs i en app för
Android och iPhone. Den här guiden visar hur du bygger apparna, testar dem på
din egen telefon och lägger ut dem i Google Play och App Store.

## Vad som är förberett

- **Ikon och startbild** med Fjällkolls logga, i alla storlekar för Android och
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
  `https://fjallkoll.pages.dev/om-appen#radera-konto`.

**Fungerar inte i apparna än:** push-notiser. De kräver Firebase för Android
och ett Apple-konto för iPhone. Klockan med notiser i appen fungerar.

## Viktigt beslut före första publiceringen: app-id

Appens id är i dag `com.fabsu951.projekt1`. Det går **aldrig** att ändra
efter att appen finns i Google Play eller App Store. Vill du ha ett snyggare
id, till exempel `se.fjallkoll.app`, är det nu det ska bytas. Säg till, så gör
jag det. Det är bara du som ser id:t, inte användarna.

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

## 2. Google Play

1. Skapa ett utvecklarkonto på
   [play.google.com/console](https://play.google.com/console). Det kostar 25 USD
   en gång. Som privatperson måste nya konton låta minst 12 testare prova appen
   i 14 dagar innan den kan publiceras öppet, till exempel familj och kompisar.
2. **Signera appen:** i Android Studio, välj Build → Generate Signed App
   Bundle → Android App Bundle → skapa en ny nyckel ("keystore").
   **Spara keystore-filen och lösenordet säkert**, till exempel i en
   lösenordshanterare och en kopia på ett USB-minne. Lägg dem aldrig i Git och
   klistra aldrig in lösenordet i en chatt.
3. I Play Console: skapa appen, ladda upp `.aab`-filen under Testing →
   Internal testing och fyll i butikssidan med texterna nedan.
4. **Dataskydd ("Data safety")**, svara så här:
   - Samlar in: e-post, namn (användarnamn), ungefärlig och exakt plats (bara
     när användaren själv lägger upp en observation, tur eller rutt), foton,
     användargenererat innehåll (observationer, turer, kommentarer).
   - Delas inte med tredje part för reklam. Krypteras under överföring.
     Användare kan begära radering: ange
     `https://fjallkoll.pages.dev/om-appen#radera-konto`.
5. **Integritetspolicy:** `https://fjallkoll.pages.dev/om-appen#integritet`

## 3. App Store (iPhone)

Det här kräver:
- en **Mac** med Xcode
- ett **Apple Developer-konto** för 99 USD per år, på
  [developer.apple.com](https://developer.apple.com).

På Macen:
```bash
cd "Svenska laviner/app"
npm install
npm run app:ios
```
I Xcode: välj ditt utvecklarteam under Signing & Capabilities, testa på din
iPhone och ladda sedan upp via Product → Archive. Fyll i butikssidan och
integritetsfrågorna i App Store Connect med samma svar som för Google Play.
Har du ingen Mac finns molntjänster som bygger iPhone-appen åt dig, till
exempel Ionic Appflow eller Codemagic.

## Butikstexter (förslag)

**Namn:** Fjällkoll – lavinprognos och turer

**Kort beskrivning (80 tecken):**
Lavinprognos, väder, karta och turer för skidåkning i svenska fjällen.

**Lång beskrivning:**
Fjällkoll samlar det du behöver inför en tur i de svenska fjällen:

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

Fjällkoll ersätter inte den officiella lavinprognosen, en lavinutbildning eller
ditt eget omdöme i fält.

**Kategori:** Sport (alternativt Väder)

**Skärmbilder:** ta 4–8 stycken från telefonen, till exempel ett område med
prognos, kartan med en planerad rutt, flödet och en tur.
