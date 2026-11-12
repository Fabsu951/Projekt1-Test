# Skaffa domänen snolage.se

Målet är att sajten ska nås på `https://snolage.se` i stället för
`fjallkoll.pages.dev`. Den gamla adressen fortsätter att fungera.

## 1. Kolla att domänen är ledig

Sök på [internetstiftelsen.se](https://internetstiftelsen.se/) ("Sök
domännamn"). Är `snolage.se` upptagen: säg till, så tar vi fram ett annat
namn innan något mer görs.

Ta gärna även **`snöläge.se`** (med prickar) om den är ledig, och låt den
peka till samma sajt. Huvudadressen bör vara `snolage.se` utan å/ä/ö: den
går att skriva på alla tangentbord och fungerar överallt, även i mejl.

## 2. Köp domänen

Cloudflare säljer inte `.se`-domäner, så köp den hos en svensk
återförsäljare, till exempel Loopia, Binero eller One.com. Det brukar kosta
runt 100–200 kr första året.

- Registrera domänen på dig som privatperson. Du anger personnummer.
- Välj **bara domänen**. Du behöver inget webbhotell eller någon e-post hos
  dem.
- Slå på förnyelse automatiskt, så att du inte tappar domänen.
- Säg nej till tillägg som webbhotell, e-post, "SEO-paket" och "domänskydd".
- Slå på tvåstegsverifiering på kontot hos återförsäljaren. Den som kommer
  åt kontot kan ta över domänen.
- Internetstiftelsen kan mejla dig för att bekräfta dina uppgifter. Svara på
  det mejlet, annars kan domänen stängas av.
- Vill du skydda namnet mer kan du även ta `snolage.com` eller
  `snolage.app`. Det behövs inte för att komma igång.

## 3. Flytta domänens DNS till Cloudflare (gratis)

1. Gå till [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a
   domain** och skriv `snolage.se`. Välj gratisplanen (**Free**).
2. Cloudflare visar två namnservrar, till exempel `ada.ns.cloudflare.com`
   och `bob.ns.cloudflare.com`.
3. Logga in hos återförsäljaren där du köpte domänen. Om **DNSSEC** är
   påslaget för domänen: stäng av det först, annars slutar domänen fungera
   när namnservrarna byts. Det kan slås på igen senare via Cloudflare.
4. Under domänens **namnservrar/DNS-servrar**: välj egna eller externa
   namnservrar och byt deras namnservrar mot Cloudflares två. Ta bort alla
   gamla.
5. Vänta tills Cloudflare mejlar att domänen är aktiv. Det tar oftast under
   en timme men kan ta upp till ett dygn.

## 4. Koppla domänen till sajten

1. I Cloudflare: **Workers & Pages** → projektet **fjallkoll** → **Custom
   domains** → **Set up a custom domain**.
2. Skriv `snolage.se` och godkänn. Gör samma sak för `www.snolage.se`.
3. Vänta några minuter. Öppna sedan `https://snolage.se` och kontrollera att
   det är Snöläge som visas.

## 5. Säg till mig när det är klart

Jag byter sedan adressen överallt där den används:

- länkar i mejl (`APP_URL` i workern)
- delningslänkar till rutter från apparna (`VITE_PUBLIC_SITE_URL`)
- integritetspolicyn och adressen för att radera konto som butikerna ska ha

Den gamla `fjallkoll.pages.dev` fortsätter att fungera, så gamla länkar går
inte sönder.

## Senare, med domänen

- **E-post från Snöläge** (bekräfta konto, glömt lösenord): domänen
  verifieras i Resend. Då kan mejlen skickas från till exempel
  `noreply@snolage.se`.
- **Kontaktadress** som `kontakt@snolage.se` kan vidarebefordras gratis
  till din Gmail via Cloudflare **Email Routing** (gjort 12 nov 2026: fabian@snolage.se).

Klistra aldrig in lösenord, API-nycklar eller koder från Cloudflare,
återförsäljaren eller Resend i chatten.
