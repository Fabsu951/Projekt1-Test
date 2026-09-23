# Projekt1

TypeScript-webbapp (React + Vite) paketerad med [Capacitor](https://capacitorjs.com/) för att kunna publiceras till App Store (iOS) och Google Play (Android).

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

## Lint

```bash
npm run lint
```
