# Marknadsföringsplan för Snöläge, säsongen 2026/27

Skriven 11 oktober 2026. Planen bygger på hur appen och tjänsterna ser ut i
dag (se `CLAUDE.md`, `APPAR.md` och `JURIDIK.md`). Siffror och datum är
förslag: justera dem efter första månaden när du ser hur det går.

## Sammanfattning

Snöläge samlar allt en toppturåkare behöver kolla före en tur i de svenska
fjällen: den officiella lavinprognosen, SMHI:s väder och varningar,
snödjup, Lantmäteriets karta med lutning, ruttplanering som jämförs med
dagens lavinproblem, observationer från andra och en turdagbok. Appen är
gratis, utan reklam och utan spårning.

Planen har tre steg:

1. **Förbered (oktober–november):** få appen in i Google Play (kräver minst
   12 testare i 14 dagar), bygg en liten kärna av ambassadörer i de sex
   prognosområdena och förbered texter, bilder och presskit.
2. **Lansera (mitten av december):** gå ut samma dag som Naturvårdsverket
   publicerar säsongens första prognoser. Då söker folk efter lavinläget,
   och nyheten har en naturlig krok.
3. **Väx under högsäsongen (februari–april):** sportlovsveckorna 7–10 och
   påsken (påskdagen 28 mars 2027) är när flest är i fjällen. Satsa på
   veckovis innehåll, partners på plats och de inbyggda delningsfunktionerna
   (delade rutter, turdagar tillsammans, flödet).

Budgeten kan vara noll kronor. Med 5 000–20 000 kr går det att lägga till
klistermärken, affischer och lite riktad annonsering under sportlovet.

Det viktigaste i hela planen: **Snöläge marknadsförs som beslutsstöd, aldrig
som något som gör fjället säkert.** Se avsnitt 4.3.

---

## 1. Utgångsläge

### Produkten i dag

| Område | Vad som finns |
| --- | --- |
| Prognoser | Naturvårdsverkets lavinprognoser för alla sex områden, med lavinproblem, väderstreck och höjdlägen. Historik för de senaste dagarna. Notis när farograden ändras i dina områden och "Prognos inför din tur". |
| Väder | SMHI:s prognoser, vädervarningar och uppmätt snödjup vid närmaste station. |
| Karta | Lantmäteriets topografiska karta, egen lutningskarta, Naturvårdsverkets terränglager (lutning och sluttningsriktning), detaljerad lutning från höjdmodellen, karta offline. |
| Planering | Rita en rutt, få längd, höjdmeter, tid, höjdprofil och vilka bitar som ligger i brant terräng där dagens lavinproblem finns. Spara som GPX, dela via länk, turdagar med vänner. |
| Gemenskap | Observationer med bild och varningstecken (även utan täckning), snabbobservation på tio sekunder, turdagbok med GPX/FIT och Health Connect/Apple Hälsa, värmekarta över turer, flöde, följa, kommentarer, gilla, nivåer. |
| Kunskap | Säkerhetsguide, råd för varje farograd och varje lavinproblem, källor överallt. |
| Språk | Svenska och engelska. |
| Plattformar | Webben på `snolage.se`, Android (testversion), iPhone (bygger i CI, inte i App Store än). |

### Förutsättningar som styr planen

- **Gratis, ingen reklam, ingen analys av hur folk använder appen.** Det
  står i integritetspolicyn och är ett säljargument. Marknadsföringen får
  inte bryta mot det (inga spårningspixlar, inga reklamkakor, se avsnitt 8).
- **E-postadresser används inte för marknadsföring.** Det står också i
  policyn. Vill du ha ett nyhetsbrev krävs ett separat frivilligt
  samtycke och en uppdaterad policy.
- **Google Play:** som privatperson måste minst 12 testare prova appen i 14
  dagar innan den får publiceras öppet (`APPAR.md`). Det är planens första
  flaskhals.
- **App Store:** kräver Apple Developer Program och stegen i `APPAR.md` § 3.
  Fram till dess kan iPhone-användare använda webben och "Lägg till på
  hemskärmen".
- **Säsongen:** prognoserna börjar i mitten av december och slutar under
  våren. Intresset toppar under sportlov och påsk.
- **Du driver tjänsten själv, privat.** Planen ska gå att genomföra på några
  timmar i veckan.

---

## 2. Mål

Mål för säsongen, till och med 30 april 2027. Alla går att följa i
`/admin/oversikt`, Google Play Console och App Store Connect.

| Mål | Siffra | Varför |
| --- | --- | --- |
| Konton | 2 500 | Visar att folk vill ha mer än att läsa prognosen. |
| Aktiva senaste veckan (under sportlovet) | 800 | Det som räknas är användning i säsong, inte nedladdningar. |
| Enheter med farogradsnotis | 1 500 | Notiser får folk att komma tillbaka utan reklam. |
| Observationer | 1 000 under säsongen, minst 30 per vecka i februari–mars | Observationerna är det som gör Snöläge bättre för varje ny användare. |
| Delade turer | 400 | Fyller värmekartan och flödet. |
| Betyg i Google Play | minst 4,5 | Avgör hur synlig appen blir i butiken. |
| Ambassadörer | minst 2 per prognosområde | Ger observationer och trovärdighet där det händer. |

Delmål: **12 testare i Google Play senast 25 oktober**, så att appen kan
publiceras öppet i god tid före lanseringen.

---

## 3. Målgrupper

### A. Toppturåkaren (huvudmålgrupp)

25–45 år, åker topptur eller offpist 5–30 dagar per säsong, ofta i
Riksgränsen, Abisko, Kebnekaise, Hemavan, Storulvån eller Funäsdalsfjällen.
Har ofta gått en lavinkurs. Läser redan lavinprognoser.se, kollar SMHI,
planerar i en kartapp och loggar turer med klockan och Strava.

- **Problem:** informationen är utspridd på fyra–fem ställen, och det är
  krångligt att se om den planerade rutten går genom terräng där dagens
  lavinproblem finns.
- **Det Snöläge ger:** allt på ett ställe, på svenska, offline, och
  ruttkollen mot prognosen.
- **Nås via:** Instagram, toppturgrupper på Facebook, lavinkurser,
  guidebolag, sportbutikernas randonnée-avdelningar, kompisar.

### B. Den som är på väg ut i offpisten

20–35 år, åker mest i backen men vill börja med topptur. Har kanske inte
gått lavinkurs än.

- **Problem:** vet inte vad prognosen betyder eller vad man ska titta på.
- **Det Snöläge ger:** säkerhetsguiden, råd för varje farograd och
  lavinproblem, lutningskartan.
- **Nås via:** lavinkurser (före och efter), studentföreningar, skidorternas
  kanaler, innehåll som förklarar.
- **Viktigt:** budskapet till den här gruppen är "gå en lavinkurs och använd
  Snöläge för att träna på att läsa prognosen", aldrig "appen räcker".

### C. Fjällvandraren på skidor

30–65 år, åker längdturer mellan stugor, ofta under påsken. Rör sig i
lavinterräng ibland utan att tänka på det.

- **Det Snöläge ger:** farograden för området, vädervarningar, snödjup,
  karta offline.
- **Nås via:** fjällstationer och stugor, Svenska Turistföreningen och
  Friluftsfrämjandet, lokalpress inför påsk.

### D. Multiplikatorer: guider, lavinutbildare, fjällstationer

Få personer som var och en når hundratals åkare per säsong.

- **Det de får:** ett gratis verktyg att visa på kurser och genomgångar,
  observationer från fältet, delade rutter till kursdeltagarna.
- **Det Snöläge får:** trovärdighet, observationer av hög kvalitet och
  spridning.

### E. Besökare från andra länder

Norrmän, tyskar, holländare och andra som åker till Riksgränsen och Abisko.
Den engelska versionen gör Snöläge till ett av få ställen där de kan läsa
den svenska prognosen på engelska.

- **Nås via:** boenden och guider i Riksgränsen och Abisko, engelska
  inlägg, App Store och Google Play på engelska.

---

## 4. Positionering och budskap

### 4.1 Positionering

> För dig som åker topptur och offpist i de svenska fjällen är Snöläge
> appen där du ser lavinprognosen, vädret, terrängen och din planerade
> rutt på ett ställe, på svenska och även utan täckning. Till skillnad från
> att hoppa mellan lavinprognoser.se, SMHI och en kartapp visar Snöläge
> direkt var din rutt går genom terräng där dagens lavinproblem finns.

### 4.2 Kärnbudskap

**Huvudbudskap:** *Allt du behöver kolla före en fjälltur, på ett ställe.*

Stödjande budskap, i den här ordningen:

1. **Prognosen möter terrängen.** Rita din rutt och se var den går i
   branter med de väderstreck och höjdlägen som dagens prognos pekar ut.
2. **Bygger på officiella källor.** Naturvårdsverket, SMHI och Lantmäteriet,
   med källa angiven överallt.
3. **Fungerar där det inte finns täckning.** Karta offline, sparade
   prognoser och observationer som skickas när du får täckning.
4. **Av och för åkare.** Observationer, turer och gemensamma turdagar.
5. **Gratis, ingen reklam, ingen spårning.**

**Förslag på slogans** (testa två–tre och behåll den som fastnar):

- "Kolla snöläget innan du går."
- "Läs fjället innan du åker."
- "Prognosen, kartan och turen. På ett ställe."

### 4.3 Regler för allt Snöläge säger (viktigt)

De här reglerna skyddar åkarna och dig. De följer friskrivningen i
användarvillkoren och frågorna i `JURIDIK.md`.

1. **Aldrig "säker", "trygg", "riskfri" eller "garanterat".** Skriv
   "beslutsstöd", "hjälper dig planera", "visar". Appen säger själv aldrig
   att en rutt är säker, och det ska inte marknadsföringen heller.
2. **Lavinkurs först.** I allt innehåll riktat till nybörjare: uppmana till
   lavinkurs, sändare, spade och sond.
3. **Inga bilder som hyllar risk.** Inga stora sluff, ingen brant åkning
   under hög farograd, ingen "send it"-ton. Visa planering, sällskap,
   utrustning och fina fjälldagar.
4. **Naturvårdsverket står för prognosen, inte för Snöläge.** Använd inte
   deras logga och skriv inte att de stöder appen. Formulering som
   fungerar: "Visar Naturvårdsverkets officiella lavinprognoser."
5. **Ange källor** i inlägg som visar prognoser, kartor eller lutning
   (Naturvårdsverket, SMHI, ©Lantmäteriet).
6. **Inga tävlingar om brant eller farligt.** Nivåsystemet belönar turer,
   höjdmeter och observationer, aldrig lutning eller risk. Kampanjer ska
   göra likadant: belöna observationer, inte prestationer.
7. **Användarnas bilder och observationer** visas bara i marknadsföring
   efter att personen har sagt ja, och med namnet de vill ha.

---

## 5. Konkurrenter och vad som gör Snöläge unikt

| Alternativ | Styrka | Var Snöläge är bättre |
| --- | --- | --- |
| lavinprognoser.se (Naturvårdsverket) | Den officiella källan, högst trovärdighet. | Snöläge visar samma prognos men lägger till väder, snödjup, karta, ruttkoll, offline och notiser. Snöläge ska komplettera och alltid länka till källan, inte tävla. |
| Varsom och Regobs (Norge) | Mogen tjänst med många observationer. | Täcker inte svenska prognosområden på samma sätt; Snöläge är svenskt och använder svenska kartor. |
| Strava | Stor gemenskap och turdagbok. | Vet inget om lavinläget. Snöläge importerar dina pass (FIT, GPX, Health Connect, Apple Hälsa) och sätter dem i ett lavinsammanhang. |
| Internationella kartappar för topptur | Bra kartor och lutning. | Saknar den svenska prognosen, Lantmäteriets karta och svenska. Ofta betalappar. |
| Toppturgrupper på Facebook | Aktuella rapporter från folk på plats. | Observationerna i Snöläge har plats, tid, varningstecken och bild, och syns på kartan och i rätt område. |

**Det ingen annan har:** ruttplanering som jämför varje del av rutten med
dagens lavinproblem (väderstreck, höjd och lutning över 30°), kombinerat
med svenska officiella källor. Det är huvudnumret i all kommunikation.

---

## 6. Kanaler och aktiviteter

### 6.1 Appbutikerna (ASO)

Butikssidan är det sista steget före en nedladdning, så den ska vara klar
före lanseringen.

**Namn i butiken (max 30 tecken i både Google Play och App Store):**
`Snöläge: lavin och topptur` (26 tecken).

**Kort beskrivning, Google Play (max 80 tecken):**
`Lavinprognoser, terrängkartor och turplanering för svenska fjällen.`

**Undertitel, App Store (max 30 tecken):** `Lavinprognos och fjällturer`

**Nyckelord, App Store (97 av max 100 tecken, kommaseparerade utan mellanslag):**
`lavin,lavinprognos,topptur,offpist,randonnée,fjäll,skidtur,lavinfara,karta,snödjup,Kebnekaise,Åre`

**Skärmbilder, i den här ordningen** (en mening överst på varje):

1. Idag-vyn: "Dagens lavinläge i dina områden"
2. Ruttplanering med markerade bitar: "Se var rutten möter dagens lavinproblem"
3. Områdessida med prognos och lavinproblem: "Naturvårdsverkets prognos, tydligt"
4. Kartan med lutning: "Lantmäteriets karta och lutning, även offline"
5. Snabbobservation: "Rapportera vad du ser på tio sekunder"
6. Flöde och turer: "Följ vänner och dela turer"

Gör en svensk och en engelsk uppsättning. Lägg skärmbilderna i
`Svenska laviner/marknad/butik/` så att de går att uppdatera inför nästa
säsong.

**Betyg:** be om betyg inne i appen först efter något positivt, till
exempel när någon sparat sin tredje tur eller fått sin första kommentar.
Aldrig mitt under planeringen av en tur. (Kräver en liten kodändring,
Google Plays och Apples egna dialoger för betyg.)

### 6.2 Webbplatsen `snolage.se`

- **Startsidan för den som inte har appen:** en tydlig rubrik, tre
  skärmbilder och knappar till Google Play, App Store (när den finns) och
  "Använd i webbläsaren".
- **Sökmotorer:** områdessidorna är det som folk söker efter ("lavinprognos
  Kebnekaise", "lavinfara Riksgränsen", "snödjup Hemavan"). Se till att
  varje områdessida har en unik titel och beskrivning med områdets namn och
  orterna i det, och att `sitemap.xml` tar med dem. Lägg in `snolage.se` i
  Google Search Console och Bing Webmaster Tools och skicka sitemapen.
- **Säkerhetsguiden** är bra innehåll för sök ("lavinproblem", "lavinskalan",
  "drevsnöflak"). Länka till den från sociala medier.
- **Presssida** `snolage.se/press` eller en sektion på Om-sidan: kort text om
  appen och dig, logga, skärmbilder och kontakt (se bilaga D).

### 6.3 Inbyggd spridning i appen

Snöläge har redan funktioner som sprider appen när den används. Lyft fram
dem:

- **Delade rutter och turdagar:** när någon bjuder in sina turkompisar ser de
  Snöläge. Gör det enkelt: en tydlig "Bjud in"-knapp efter att en rutt
  sparats, och en snygg förhandsvisning (titel, bild, beskrivning) när
  länken delas i Messenger, WhatsApp och sms.
- **Observationer som delas:** en delad observation ska se bra ut i en
  chatt och leda till appen.
- **"Snöläget i dag" som bild:** en knapp på områdessidan som gör en
  delbar bild med farograden, områdets namn, datum och "Källa:
  Naturvårdsverket", som folk kan lägga i sina stories. (Kodidé, valfri.)

### 6.4 Sociala medier

Detaljerad spelbok med manus, inlägg och schema: `SOCIALA-MEDIER.md`.

**Instagram är huvudkanalen** (det är där toppturåkare finns). Facebook för
grupperna. TikTok och Reels är valfria, samma korta klipp kan läggas på
båda.

Skapa kontot `@snolage` (och `@snolage.se` om det första är taget) på
Instagram, Facebook och TikTok nu, även om de inte används direkt.

**Fast veckorytm under säsongen (ca 2 timmar i veckan):**

| Dag | Inlägg | Innehåll |
| --- | --- | --- |
| Torsdag kväll | **Snöläget inför helgen** | En bild per område eller en karusell: farograd, viktigaste lavinproblemet, SMHI:s varningar. Källa Naturvårdsverket och SMHI. Avsluta med "Läs hela prognosen i Snöläge eller på lavinprognoser.se". |
| Måndag | **Veckans observation** | En observation från en användare (med lov): vad hen såg och varför det är viktigt. |
| En gång i veckan, valfri dag | **Lär dig mer** | Serie: de sex lavinproblemen, lavinskalan, "så läser du prognosen", "så planerar du en rutt i Snöläge", varningstecknen. |

Utanför säsongen: ett inlägg varannan vecka (nya funktioner, sommarbilder
från fjällen, "hur säsongen gick").

**Toppturgrupper på Facebook:** gå med som dig själv, svara på frågor och
dela när det passar. Skriv ett ordentligt presentationsinlägg vid
lanseringen ("Jag har byggt en svensk lavinapp, gratis, vill gärna ha
synpunkter") efter att ha frågat administratören. Spamma aldrig.

### 6.5 Ambassadörer

Målet är **2–4 personer per prognosområde** som åker mycket, gärna
lägger in observationer och kan berätta om Snöläge i sina kretsar.

| Område | Orter att leta i |
| --- | --- |
| Riksgränsfjällen | Riksgränsen, Björkliden, Abisko |
| Kebnekaisefjällen | Kebnekaise fjällstation, Nikkaluokta, Kiruna |
| Västra Vindelfjällen | Ammarnäs |
| Södra Lapplandsfjällen | Hemavan, Tärnaby |
| Södra Jämtlandsfjällen | Storulvån, Sylarna, Åre |
| Västra Härjedalsfjällen | Funäsdalen, Tänndalen, Ljungdalen |

**Så hittar du dem:** de som redan lägger in observationer och turer,
testarna från Google Play, kompisar till kompisar, aktiva i
toppturgrupperna, studenter i friluftsföreningar i Umeå, Luleå, Östersund
och Kiruna.

**Vad de får:** direkt kontakt med dig (en gruppchatt), möjlighet att
påverka nya funktioner, tidig tillgång till nya versioner, Snöläge-
klistermärken och ett tack på Om-sidan om de vill. Ingen betalning behövs.

**Vad du ber om:** lägg in observationer när du är ute, dela en tur eller
rutt ibland, säg till när något är fel.

### 6.6 Partners

Börja med de som når många åkare. Mejlmall finns i bilaga C.

| Partner | Erbjudande till dem | Det du ber om |
| --- | --- | --- |
| **Lavinutbildare och guidebolag** | Gratis verktyg för kurser: visa prognos, lutning och ruttkoll. Ett utskriftsblad med QR-kod till deltagarna. | Att visa Snöläge på kursen, dela rutter med deltagarna, lägga in observationer. |
| **Fjällstationer, stugor och boenden** (t.ex. STF:s fjällstationer i Abisko, Kebnekaise och Storulvån) | En A4-affisch med QR-kod och "Dagens lavinläge" för anslagstavlan. | Att sätta upp affischen och nämna Snöläge vid genomgångar. |
| **Sportbutiker med randonnée-utrustning** | Klistermärken och affisch vid kassan eller lavinutrustningen. | Att lägga ett kort i påsen när någon köper sändare eller toppturpaket. |
| **Föreningar** (Friluftsfrämjandet, skid- och friluftsklubbar, studentföreningar) | Ett kort föredrag eller en digital genomgång: "Så läser du lavinprognosen". | Att tipsa medlemmarna. |
| **Skidorter med offpist** | Länk till områdets sida i Snöläge från deras offpistsida. | Att länka och sätta upp affischen vid offpist-entréerna. |

**Naturvårdsverket:** du har redan kontakt med Petter och Jan. Berätta
innan lanseringen att Snöläge går ut brett, vilka källor och vilken
formulering du använder, och fråga om de har synpunkter på hur prognosen
visas. Be inte om att bli rekommenderad, men om de själva vill länka är det
värdefullt. Spara deras svar.

### 6.7 Press och media

**Tre nyhetsvinklar:**

1. **Lansering (mitten av december):** "Ny svensk app samlar lavinprognos,
   väder och karta för fjällturen", med dig i centrum: du har byggt
   appen du själv saknade.
2. **Sportlovet (början av februari):** "Planerar du topptur på sportlovet?
   Ny app kollar din rutt mot lavinprognosen."
3. **Påsk (mitten av mars):** riktat till fjällvandrare på skidor: "Kolla
   lavinläget innan påskturen", tillsammans med råd från säkerhetsguiden.

**Var:**

- Lokalt där fjällen är: SVT Nyheter Norrbotten, Västerbotten och
  Jämtlandsnytt, NSD, Norrbottens-Kuriren, Västerbottens-Kuriren,
  Östersunds-Posten, Länstidningen Östersund, Härjedalens lokalmedia, Sveriges
  Radio P4 i Norrbotten, Västerbotten och Jämtland.
- Friluftsmedia: Åka Skidor, Utemagasinet, Friluftsfrämjandets och STF:s
  medlemstidningar, skid- och friluftspoddar.
- Din egen ort och ditt lärosäte, om det passar ("student bygger...").

**Så går du till väga:** ett kort mejl till rätt reporter (inte en allmän
adress) med pressmeddelandet i mejlet, länk till presssidan och tre bilder.
Följ upp en gång efter två dagar. Pressmeddelande finns i bilaga B.

### 6.8 På plats i fjällen

- **Klistermärken** (rund, 6–8 cm, loggan och `snolage.se`) till
  ambassadörer, butiker och kurser. Folk sätter dem på skidor och
  termosar.
- **A4-affisch med QR-kod** för fjällstationer, stugor och butiker (bilaga E).
  QR-koden leder till en egen adress per plats, till exempel
  `snolage.se/abisko`, så att du ser vilka affischer som fungerar (se
  avsnitt 8).
- Fråga alltid ägaren innan du sätter upp något. Inga lappar vid
  parkeringar eller leder utan lov.

### 6.9 Betald annonsering (valfritt, liten budget)

Bara under sportlov och påsk, och bara om den fria marknadsföringen är
igång.

- **Instagram och Facebook:** 2–3 korta annonser med ruttkollen som
  huvudbild, riktade till personer i eller på väg till fjällkommunerna med
  intresse för skidåkning och friluftsliv. Ca 100–150 kr per dag i två–tre
  veckor.
- **Google sökannonser** på "lavinprognos", "lavinfara" och områdenas namn,
  under de veckor prognoserna publiceras.
- **Apple Search Ads**, när appen finns i App Store, på "lavin" och
  "topptur".

Annonserna ska leda till butikssidan eller `snolage.se`. Lägg inte in
Metas eller Googles spårningskod i appen eller på webben: det strider mot
integritetspolicyn. Följ resultatet i annonsverktygets egna siffror och i
Play Console.

---

## 7. Tidsplan

### Oktober: grunden

| Vecka | Att göra |
| --- | --- |
| v. 42 (12–18 okt) | Skicka inbjudan till minst 15 testare för Google Plays stängda test (familj, kompisar, skidkompisar). Skapa konton på Instagram, Facebook, TikTok. Välj slogan. |
| v. 43 (19–25 okt) | **Senast 25 okt: 12 testare igång.** Ta skärmbilder och skriv butikstexterna (bilaga A). Sätt upp Google Search Console för `snolage.se`. |
| v. 44 (26 okt–1 nov) | Skriv en lista över 20–30 tänkbara ambassadörer och 15–20 partners. Beställ klistermärken. Gör presssidan. |

### November: förbered lanseringen

| Vecka | Att göra |
| --- | --- |
| v. 45 (2–8 nov) | Testperioden i Google Play klar (14 dagar). Ansök om produktion. Kontakta ambassadörer. Fortsätt med Apple Developer Program om iPhone ska hinna till sportlovet. |
| v. 46 (9–15 nov) | Mejla partners (lavinkurser först: de planerar vinterns kurser nu). Mejla Naturvårdsverket om lanseringen. |
| v. 47 (16–22 nov) | Förbered 8–10 inlägg för lanseringen och de första veckorna (lavinproblemen, lavinskalan, "så planerar du en rutt"). Gör affischen. |
| v. 48 (23–29 nov) | Börja posta på Instagram ("snart"). Ambassadörsgruppen igång. Skicka affischer och klistermärken till partners. |
| v. 49–50 (30 nov–13 dec) | Kolla att allt fungerar inför säsongen: prognoser, notiser, offline. Skriv det slutliga pressmeddelandet. Kontakta lokalpress i förväg och säg att det kommer. |

### December–januari: lansering

| När | Att göra |
| --- | --- |
| **Dagen för säsongens första prognos** (mitten av december, kolla datumet hos Naturvårdsverket) | Lanseringen: inlägg i alla kanaler, pressmeddelande till lokalpress och friluftsmedia, presentationsinlägg i toppturgrupperna, ambassadörerna delar. |
| Veckorna efter | Starta veckorytmen (6.4). Svara på alla recensioner och meddelanden inom ett dygn. |
| Mellandagarna och nyår | Många åker till fjällen: ett inlägg om att spara kartan offline före resan. |
| Januari | Följ upp siffrorna (avsnitt 8). Fixa det användarna klagar på. Förbered sportlovet. |

### Februari–april: högsäsong

| När | Att göra |
| --- | --- |
| Början av februari | Pressutskick med sportlovsvinkeln. Starta eventuell annonsering. |
| v. 7–10 (15 feb–14 mar) | Sportlov. Veckorytmen plus extra "Snöläget inför helgen" vid snöfall eller ändrad farograd. Lyft observationer. |
| Mitten av mars | Pressutskick och inlägg för påskens fjällvandrare. |
| Påsk (26–29 mars 2027) | Påskinlägg: farograd, väder, karta offline, lavinterräng längs vanliga leder. |
| April | Vårskidåkning: våta laviner och glidlaviner i fokus. Tacka ambassadörerna. |

### Maj–september: utvärdera och förbered nästa säsong

- **Maj:** säsongsrapport ("så här använde ni Snöläge i vinter") på
  Instagram och för pressen. Utvärdera målen. Fråga ambassadörerna vad som
  saknades.
- **Juni–augusti:** låg aktivitet. Bygg det som efterfrågades. Ett och annat
  inlägg (barmarkssäsongen, säkerhetsguiden).
- **September:** uppdatera butikssidor, skärmbilder och planen inför
  2027/28.

---

## 8. Mätning och uppföljning

Snöläge lovar ingen analys av hur folk använder appen, så mätningen bygger
på summerade siffror som redan finns.

| Vad | Var |
| --- | --- |
| Konton, aktiva senaste veckan, observationer, turer, rutter, notiser per vecka och per område | `/admin/oversikt` i appen |
| Installationer, avinstallationer, betyg, recensioner, sökord i butiken | Google Play Console, App Store Connect |
| Sökord och besök från Google till `snolage.se` | Google Search Console |
| Annonsresultat | Annonsverktygets egna siffror |
| Vilka affischer och partners som fungerar | Egna adresser per kanal, till exempel `snolage.se/abisko`, `snolage.se/kurs`, `snolage.se/press`. Gör dem till omdirigeringar i Cloudflare (Redirect Rules) till rätt sida, och läs antalet besök per adress i Cloudflares trafikstatistik. Ingen kaka eller spårning hos användaren. |

**Ett möjligt tillägg:** en frivillig fråga vid registreringen, "Var hörde
du om Snöläge?" (vänner, Instagram, kurs, butik, press, annat). Svaret ger
bra underlag men är en ny uppgift om användaren: uppdatera
integritetspolicyn först.

**Rytm:**

- **Varje måndag under säsongen (15 minuter):** titta på
  `/admin/oversikt` och butikerna. Notera nya konton, aktiva, observationer
  och betyg i en enkel tabell.
- **En gång i månaden (en timme):** vad fungerade? Lägg mer tid där och
  sluta med det som inte ger något.

---

## 9. Budget

| Post | Nivå 0 kr | Nivå ca 5 000 kr | Nivå ca 20 000 kr |
| --- | --- | --- | --- |
| Klistermärken (500 st) | – | ca 1 500 kr | ca 1 500 kr |
| Affischer (utskrift, 50 st) | skriv ut själv | ca 500 kr | ca 1 000 kr |
| Annonser i sociala medier (sportlov, påsk) | – | ca 3 000 kr | ca 8 000 kr |
| Google sökannonser | – | – | ca 4 000 kr |
| Apple Search Ads | – | – | ca 2 000 kr |
| Små tack till ambassadörer (mössor, buffar med logga) | – | – | ca 3 500 kr |

Kostnader som inte är marknadsföring men behövs för planen:

- **Apple Developer Program:** ca 99 USD per år, krävs för App Store.
- **Varumärkesregistrering hos PRV** (`JURIDIK.md` punkt 9): rimligt att göra
  före bred lansering så att ingen annan registrerar namnet. Kolla aktuell
  avgift hos PRV.
- **Ett möte med en jurist** om ansvarsfrågorna i `JURIDIK.md` innan
  pressutskicket.

**Rekommendation:** börja på nivå 0, gå upp till 5 000 kr inför
sportlovet om siffrorna i januari visar att folk stannar kvar
(aktiva per vecka växer, betyget är högt).

---

## 10. Risker

| Risk | Vad du gör |
| --- | --- |
| **En olycka där någon har använt Snöläge.** | Ha ett kort förberett svar: "Vi beklagar djupt. Snöläge visar Naturvårdsverkets prognoser och annan information som stöd. Det ersätter inte egen bedömning, kunskap och utrustning." Kommentera aldrig den enskilda händelsen. Pausa marknadsföring i några dagar. Läs igenom alla texter mot reglerna i 4.3. Kontakta en jurist. |
| **Naturvårdsverket ogillar hur prognosen visas.** | Ta kontakt innan lanseringen (6.6). Ändra snabbt om de har synpunkter. Länka alltid till lavinprognoser.se. |
| **För få testare för Google Play.** | Börja nu. Fråga brett. Webben fungerar under tiden. |
| **iPhone-appen hinner inte.** | Lansera webben och Android. Skriv tydligt hur man lägger Snöläge på hemskärmen på iPhone. Ta App Store som en egen nyhet senare. |
| **Lite observationer i början, så gemenskapen känns tom.** | Ambassadörerna lägger in de första. Lyft varje observation i "Veckans observation". Visa prognos och väder så att appen är användbar även utan observationer. |
| **Olämpligt innehåll eller fel i observationer.** | Anmälningsfunktionen finns. Kolla `/admin` dagligen under högsäsong. Skriv i inlägg att observationer är andra åkares bild, inte en bedömning. |
| **Belastning eller kostnader vid många användare.** | Cloudflares gratisnivå har gränser (importen stötte redan på en). Följ Cloudflares statistik under lanseringsveckan och sportlovet och var beredd att gå upp i plan. |
| **Dåliga recensioner tidigt.** | Svara på alla, vänligt och konkret. Fixa det som går och svara när det är fixat. |
| **Det tar för mycket tid.** | Veckorytmen är det enda som måste göras. Allt annat kan hoppas över en vecka. |

---

## 11. De kommande 14 dagarna

- [ ] Skicka inbjudan till minst 15 testare i Google Plays stängda test.
- [ ] Skapa `@snolage` på Instagram, Facebook och TikTok.
- [ ] Välj slogan (4.2).
- [ ] Ta skärmbilder på en telefon, svenska och engelska (6.1).
- [ ] Klistra in butikstexterna från bilaga A i Play Console.
- [ ] Lägg till `snolage.se` i Google Search Console och skicka sitemapen.
- [ ] Skriv listan över tänkbara ambassadörer och partners.
- [ ] Bestäm om iPhone ska hinna till sportlovet (då behövs Apple Developer
      Program nu).
- [ ] Boka tid med en jurist om punkterna 1–2 i `JURIDIK.md`.

---

## Bilaga A. Butikstexter

**Kort beskrivning (Google Play, 67 tecken):**

> Lavinprognoser, terrängkartor och turplanering för svenska fjällen.

**Lång beskrivning (Google Play och App Store):**

> Snöläge samlar allt du behöver kolla före en tur i de svenska fjällen.
>
> **LAVINLÄGET**
> • Naturvårdsverkets lavinprognoser för alla sex prognosområden
> • Lavinproblemen med väderstreck och höjdlägen, och farograden de senaste dagarna
> • Notis när farograden ändras i dina områden
> • Råd för varje farograd och varje lavinproblem
>
> **VÄDER OCH SNÖ**
> • SMHI:s prognos och vädervarningar
> • Uppmätt snödjup vid närmaste station
>
> **KARTA OCH TERRÄNG**
> • Lantmäteriets topografiska karta
> • Lutning och sluttningsriktning
> • Spara kartan för användning utan täckning
>
> **PLANERA TUREN**
> • Rita din rutt och se längd, höjdmeter, tid och höjdprofil
> • Se vilka delar av rutten som går i brant terräng där dagens lavinproblem finns
> • Spara som GPX, dela med vänner och planera turdagar tillsammans
>
> **DELA MED ANDRA**
> • Rapportera vad du ser, även utan täckning
> • Ladda upp turer från klockan (GPX, FIT, Health Connect, Apple Hälsa)
> • Följ vänner, kommentera och se var andra åker
>
> Gratis, utan reklam och utan spårning. På svenska och engelska.
>
> Snöläge är ett stöd för din planering och ersätter inte egen bedömning,
> lavinkunskap och utrustning. Prognoserna kommer från Naturvårdsverket,
> väder från SMHI och kartor från ©Lantmäteriet.

**Engelsk kort beskrivning (74 tecken):**

> Avalanche forecasts, terrain maps and trip planning for Swedish mountains.

## Bilaga B. Pressmeddelande (lansering)

> **Ny svensk app samlar lavinprognos, väder och karta inför fjällturen**
>
> I dag publicerar Naturvårdsverket säsongens första lavinprognoser. Samtidigt
> lanseras Snöläge, en gratis app som samlar allt en toppturåkare behöver
> kolla före en tur i de svenska fjällen.
>
> I Snöläge ser man Naturvårdsverkets lavinprognos för fjällområdet, SMHI:s
> väder och varningar, uppmätt snödjup och Lantmäteriets karta med lutning,
> på ett ställe och även utan täckning. Den som planerar en tur kan rita
> sin rutt och se vilka delar som går genom branter där dagens prognos
> pekar ut lavinproblem.
>
> – Jag har själv hoppat mellan fyra–fem sajter innan varje tur. Jag ville
> ha allt på ett ställe, på svenska, och kunna se hur prognosen hänger ihop
> med just min rutt, säger Fabian Sund som har byggt appen.
>
> Åkare kan också rapportera vad de ser i fjället, som färska laviner eller
> skjutsprickor, så att andra får en bättre bild av läget.
>
> – Snöläge ersätter inte lavinkunskap eller egen bedömning. Gå en lavinkurs,
> ha med sändare, spade och sond, och använd appen som stöd i planeringen,
> säger Fabian Sund.
>
> Snöläge är gratis, utan reklam, och finns på snolage.se och i Google Play
> [och App Store].
>
> **Kontakt:** Fabian Sund, [e-post], [telefon]
> **Bilder och logga:** snolage.se/press

Anpassa citaten så att de låter som du.

## Bilaga C. Mejl till partner

> **Ämne:** Gratis lavinapp till era kurser i vinter
>
> Hej [namn],
>
> Jag heter Fabian och har byggt Snöläge, en gratis app för toppturåkare i de
> svenska fjällen. Den visar Naturvårdsverkets lavinprognos, SMHI:s väder,
> snödjup och Lantmäteriets karta med lutning på ett ställe, och man kan
> rita en rutt och se var den går i branter där dagens lavinproblem finns.
>
> Jag tror den kan vara till nytta på era [kurser/genomgångar/i stugan] i
> vinter, till exempel för att visa hur man läser prognosen och jämför den
> med terrängen. Jag skickar gärna ett utskriftsblad med QR-kod till
> deltagarna, eller en affisch.
>
> Appen ersätter inte kurs eller egen bedömning, och det står tydligt i den.
>
> Har ni tid för ett kort samtal, eller vill ni prova den först? Den finns på
> snolage.se.
>
> Vänliga hälsningar
> Fabian Sund

## Bilaga D. Presssida

- En mening: "Snöläge samlar lavinprognos, väder, karta och turplanering
  för de svenska fjällen, gratis och utan reklam."
- Ett stycke om appen och ett om dig.
- Fakta: lanseringsdatum, plattformar, de sex områdena, källor
  (Naturvårdsverket, SMHI, Lantmäteriet), gratis, svenska och engelska.
- Logga (ljus och mörk), 4–6 skärmbilder, ett foto av dig.
- Kontakt.

## Bilaga E. Affisch (A4)

> **Hur är lavinläget i dag?**
>
> [QR-kod till snolage.se/<plats>]
>
> Snöläge: Naturvårdsverkets lavinprognos, SMHI:s väder, snödjup och karta
> med lutning för [området]. Gratis.
>
> Snöläge är ett stöd för din planering. Gå en lavinkurs och ha med
> sändare, spade och sond.
>
> snolage.se
