# Skaffa domänen turkoll.se

Målet är att sajten ska nås på `https://turkoll.se` i stället för
`fjallkoll.pages.dev`. Den gamla adressen fortsätter att fungera.

## 1. Kolla att domänen är ledig

Sök på [internetstiftelsen.se](https://internetstiftelsen.se/) ("Sök
domännamn"). Är `turkoll.se` upptagen: säg till, så tar vi fram ett annat
namn innan något mer görs.

## 2. Köp domänen

Cloudflare säljer inte `.se`-domäner, så köp den hos en svensk
återförsäljare, till exempel Loopia, Binero eller One.com. Det brukar kosta
runt 100–200 kr första året.

- Registrera domänen på dig som privatperson. Du anger personnummer.
- Välj **bara domänen**. Du behöver inget webbhotell eller någon e-post hos
  dem.
- Slå på förnyelse automatiskt, så att du inte tappar domänen.
- Vill du skydda namnet mer kan du även ta `turkoll.com` eller
  `turkoll.app`. Det behövs inte för att komma igång.

## 3. Flytta domänens DNS till Cloudflare (gratis)

1. Gå till [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a
   domain** och skriv `turkoll.se`. Välj gratisplanen (**Free**).
2. Cloudflare visar två namnservrar, till exempel `ada.ns.cloudflare.com`
   och `bob.ns.cloudflare.com`.
3. Logga in hos återförsäljaren där du köpte domänen. Under domänens
   **namnservrar/DNS-servrar**, byt deras namnservrar mot Cloudflares två.
4. Vänta tills Cloudflare mejlar att domänen är aktiv. Det tar oftast under
   en timme men kan ta upp till ett dygn.

## 4. Koppla domänen till sajten

1. I Cloudflare: **Workers & Pages** → projektet **fjallkoll** → **Custom
   domains** → **Set up a custom domain**.
2. Skriv `turkoll.se` och godkänn. Gör samma sak för `www.turkoll.se`.
3. Vänta några minuter. Öppna sedan `https://turkoll.se` och kontrollera att
   det är Turkoll som visas.

## 5. Säg till mig när det är klart

Jag byter sedan adressen överallt där den används:

- länkar i mejl (`APP_URL` i workern)
- delningslänkar till rutter från apparna (`VITE_PUBLIC_SITE_URL`)
- integritetspolicyn och adressen för att radera konto som butikerna ska ha

Den gamla `fjallkoll.pages.dev` fortsätter att fungera, så gamla länkar går
inte sönder.

## Senare, med domänen

- **E-post från Turkoll** (bekräfta konto, glömt lösenord): domänen
  verifieras i Resend. Då kan mejlen skickas från till exempel
  `noreply@turkoll.se`.
- **Kontaktadress** som `kontakt@turkoll.se` kan vidarebefordras gratis
  till din Gmail via Cloudflare **Email Routing**.

Klistra aldrig in lösenord, API-nycklar eller koder från Cloudflare,
återförsäljaren eller Resend i chatten.
