# Fjällkoll

TypeScript-webbapp (React + Vite) paketerad med [Capacitor](https://capacitorjs.com/) för att kunna publiceras till App Store (iOS) och Google Play (Android) — och samma kod publiceras som en vanlig hemsida.

## Struktur

- `src/` – appens källkod (React + TypeScript)
- `android/` – genererat native Android-projekt (öppnas i Android Studio)
- `ios/` – genererat native iOS-projekt (öppnas i Xcode, kräver macOS)
- `capacitor.config.ts` – Capacitor-konfiguration (app-id: `com.fabsu951.projekt1`)

## Utveckling

```bash
npm install
npm run dev
```

Öppnar appen i webbläsaren på `http://localhost:5173` med hot reload.

## Bygga för mobil

Varje gång webbkoden ändras måste den byggas om och synkas till de native-projekten:

```bash
npm run build
npx cap sync
```

### Android (Play Store)

Kräver [Android Studio](https://developer.android.com/studio).

```bash
npx cap open android
```

Bygg en signerad `.aab`-fil via Android Studio (Build → Generate Signed App Bundle) och ladda upp den i [Google Play Console](https://play.google.com/console).

### iOS (App Store)

Kräver macOS och [Xcode](https://developer.apple.com/xcode/).

```bash
npx cap open ios
```

Arkivera och ladda upp appen via Xcode Organizer till [App Store Connect](https://appstoreconnect.apple.com/).

## Publicera som hemsida (Cloudflare Pages)

1. Skapa ett gratis konto på [Cloudflare](https://dash.cloudflare.com/sign-up) om du inte redan har ett.
2. I Cloudflare-dashboarden: **Workers & Pages → Create → Pages → Connect to Git**, välj repot `Fabsu951/Projekt1-Test` och branchen `svenska-laviner`.
3. Bygginställningar:
   - **Root directory**: `Svenska laviner/app`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Klart — varje push till branchen bygger och publicerar om sidan automatiskt. `public/_redirects` ser till att sid-routing (t.ex. `/omrade/kebnekaisefjallen`) fungerar vid direktnavigering, inte bara via länkar i appen.

## Lint

```bash
npm run lint
```
