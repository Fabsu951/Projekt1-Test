/**
 * Set in mobile/.env as EXPO_PUBLIC_API_URL=http://<din-dators-lokala-IP>:3000
 * Expo inlines EXPO_PUBLIC_-prefixade variabler vid bundling, så servern
 * startas om (npx expo start) efter att .env ändras.
 */
export function getApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL är inte satt. Skapa mobile/.env med t.ex. EXPO_PUBLIC_API_URL=http://192.168.1.23:3000'
    );
  }
  return url;
}
