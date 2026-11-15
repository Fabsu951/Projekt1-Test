import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PRIVACY_CONTACT_EMAIL } from "../data/contact";
import { t, isEnglish } from "../i18n";
import LanguageSwitch from "../components/LanguageSwitch";
import AppearanceSettings from "../components/AppearanceSettings";

export default function AboutPage() {
  const { hash } = useLocation();

  // Client-side navigation doesn't scroll to #anchors on its own.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Om Snöläge")}</h1>
        <p className="page__lead">
          {t("Lavinläget, vädret och terrängen i de svenska fjällen samlat på ett ställe, för dig som åker skidor utanför pisten.")}
        </p>
      </header>

      <div className="notice notice--danger">
        <strong>{t("Snöläge ersätter inte officiell lavinprognos eller lavinutbildning.")}</strong>
        <p>
          {t("Farograderna hämtas automatiskt från den officiella prognosen och kan vara fördröjda eller, i sällsynta fall, feltolkade. Innan du ger dig ut, läs alltid hela den officiella prognosen på")}{" "}
          <a href="https://www.lavinprognoser.se" target="_blank" rel="noreferrer">
            {t("lavinprognoser.se")}
          </a>{" "}
          {t("(Naturvårdsverket).")}
        </p>
      </div>

      <section className="section">
        <h2>{t("Vad Snöläge gör")}</h2>
        <p>
          {t("Snöläge är ett komplement till de officiella källorna, inte en ersättning för dem. För de sex officiella lavinprognosområdena i svenska fjällen får du:")}
        </p>
        <ul>
          <li>
            <strong>{t("Farograd")}</strong>{" "}{t("från den officiella lavinprognosen, med länk till hela prognosen")}
          </li>
          <li>
            <strong>{t("Väder och vind")}</strong>{" "}{t("från SMHI, med uppskattning av vilka sluttningar som kan vara vindlastade")}
          </li>
          <li>
            <strong>{t("Karta")}</strong>{" "}{t("med Lantmäteriets topografiska karta och lager som visar hur brant terrängen är")}
          </li>
          <li>
            <strong>{t("Observationer")}</strong>{" "}{t("från andra åkare: skapa ett konto för att dela vad du själv ser i fjällen")}
          </li>
          <li>
            <strong>{t("Säkerhetsguide")}</strong>{" "}{t("med grunderna om snötäcket, lavinproblemen och lavinskalan")}
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>{t("Utan täckning")}</h2>
        <p>
          {t("Appen, den senast hämtade prognosen och vädret, sparade kartor och rutter fungerar utan mobilnät.")}{" "}
          <Link to="/offline">{t("Se exakt vad som fungerar och vad som är sparat på din enhet")}</Link>.
        </p>
      </section>

      <section className="section">
        <h2>{t("Vad Snöläge inte gör")}</h2>
        <ul>
          <li>{t("Ersätter inte lavinutbildning eller erfarenhet i fjällterräng")}</li>
          <li>{t("Ersätter inte ett dagligt beslut baserat på den officiella lavinprognosen")}</li>
          <li>{t("Fattar inga beslut åt dig – du ansvarar alltid själv för din säkerhet")}</li>
        </ul>
      </section>

      <section className="section" id="press">
        <h2>{t("För press")}</h2>
        <p>
          {t("Texter, fakta, logotyp och skärmbilder att ladda ner finns på")}{" "}
          <Link to="/press">{t("Snöläge för press")}</Link>.
        </p>
      </section>

      <section className="section" id="sprak">
        <h2>{t("Språk")}</h2>
        <p>
          {t("Snöläge finns på svenska och engelska. Lavinprognosernas texter från Naturvårdsverket, inlägg från andra åkare, notiser och mejl är på svenska.")}
        </p>
        <LanguageSwitch className="button" />
      </section>

      <section className="section" id="utseende">
        <h2>{t("Utseende")}</h2>
        <AppearanceSettings />
      </section>

      <section className="section">
        <h2>{t("Källor")}</h2>
        <ul>
          <li>
            {t("Väderprognos, uppmätt vind, snödjup och vädervarningar:")}{" "}
            <a href="https://www.smhi.se" target="_blank" rel="noreferrer">{t("SMHI")}</a>{" "}
            {t("öppna data (CC BY 4.0). Vindlasten per väderstreck är Snöläges egen beräkning från SMHI:s vind.")}
          </li>
          <li>
            {t("Ortnamnen i kartans sökning:")}{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              {t("© OpenStreetMap-bidragsgivare")}
            </a>{" "}
            {t("(ODbL). De ingår i appen, så sökningen fungerar utan täckning.")}
          </li>
          <li>
            {t("Beräknat snödjup på fjället:")}{" "}
            <a href="https://www.senorge.no" target="_blank" rel="noreferrer">{t("seNorge")}</a>{" "}
            {t("från NVE och MET Norway (CC BY 3.0), med NVE:s tillåtelse. Modellen är inte utvärderad på svensk sida. Väntat snöfall räknar Snöläge fram från SMHI:s prognos.")}
          </li>
          <li>
            {t("Lavinprognoser:")}{" "}<a href="https://www.lavinprognoser.se" target="_blank" rel="noreferrer">
              {t("Naturvårdsverket")}
            </a>
          </li>
          <li>
            {t("Topografisk karta:")}{" "}<a href="https://www.lantmateriet.se/" target="_blank" rel="noreferrer">
              {t("Lantmäteriet")}
            </a>{" "}
            {t("(datakälla: Topografisk webbkarta Nedladdning, raster, och tidigare Topografisk webbkarta Visning, översiktlig), ©Lantmäteriet,")}{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.sv" target="_blank" rel="noreferrer">
              {t("CC BY 4.0")}
            </a>
            {t(". Kartbilderna visas obearbetade.")}
          </li>
          <li>
            {t("Karta över Norge:")}{" "}<a href="https://www.kartverket.no/" target="_blank" rel="noreferrer">
              {t("Kartverket")}
            </a>{" "}
            {t("(Topografisk Norgeskart), ©Kartverket,")}{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.sv" target="_blank" rel="noreferrer">
              {t("CC BY 4.0")}
            </a>
            {t(". Visas obearbetad ovanpå Lantmäteriets karta.")}
          </li>
          <li>
            {t("Detaljerad lutning (när den finns): beräknad av Snöläge från Lantmäteriets höjdmodell (Markhöjdmodell Nedladdning, grid 1+), ©Lantmäteriet,")}{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.sv" target="_blank" rel="noreferrer">
              {t("CC BY 4.0")}
            </a>
            {t(". Bearbetad: lutningen är uträknad och indelad i steg.")}
          </li>
          <li>
            {t("Höjder och lutning i ruttplaneringen och i ”Hitta åk”: beräknade av Snöläge från höjdmodeller med 1 m upplösning, Lantmäteriets Markhöjdmodell Nedladdning (©Lantmäteriet, CC0) och Kartverkets terrängmodell (©Kartverket, CC BY 4.0), hämtade via")}{" "}
            <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noreferrer">
              {t("Mapterhorn")}
            </a>
            {t(". Bearbetad: lutningen är uträknad och indelad i steg.")}
          </li>
          <li>
            {t("Lutning och utlöpszoner i Norge:")}{" "}<a href="https://www.nve.no/" target="_blank" rel="noreferrer">
              {t("NVE")}
            </a>{" "}
            {t("(Bratthet och Bratthet med utløp, samma kartor som Varsom visar), ©NVE. Visas obearbetade.")}
          </li>
          <li>
            {t("Appen bygger på öppen källkod, bland annat React, Leaflet, React Leaflet, Capacitor och Firebase.")}{" "}
            <a href="/licenser.txt">
              {t("Licenser för öppen källkod")}
            </a>
          </li>
        </ul>
      </section>

      <section className="section terms" id="villkor">
        <h2>{t("Användarvillkor")}</h2>
        <p className="muted">{t("Senast uppdaterade 19 oktober 2026.")}</p>
        {isEnglish() && <p className="muted">This is a translation. The Swedish version of the terms is the one that applies.</p>}
        <p>
          {t("Snöläge drivs av Fabian Sund som privatperson")}
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              (<a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>)
            </>
          )}
          {t(". Appen är gratis. Prognoser, väder, karta och säkerhetsguide kan du använda utan konto. Villkoren nedan gäller när du skapar ett konto och delar innehåll.")}
        </p>

        <h3>{t("Ditt ansvar i fjällen")}</h3>
        <p>
          {t("Allt i Snöläge är information som stöd för dina egna beslut, ingen garanti. Farograder hämtas automatiskt och kan vara fördröjda eller fel. Lutningskartor och ruttanalys bygger på grov höjddata och missar korta branter. Observationer och turer kommer från andra användare och kan vara felaktiga eller inaktuella. \"Dela position\" är ingen larm- eller räddningstjänst: den kräver täckning och att appen är öppen, och ersätter inte sändare/mottagare, spade och sond. Vid en olycka, ring 112. Läs alltid den officiella prognosen på lavinprognoser.se och bedöm förhållandena på plats. Du ansvarar själv för din säkerhet och för de beslut du fattar i terrängen.")}
        </p>

        <h3>{t("Konto")}</h3>
        <ul>
          <li>{t("Du måste vara minst 13 år för att skapa ett konto.")}</li>
          <li>{t("Ett konto per person. Håll lösenordet för dig själv. Du ansvarar för det som görs från ditt konto.")}</li>
          <li>{t("Ditt användarnamn får inte vara stötande eller utge sig för att vara någon annan.")}</li>
        </ul>

        <h3>{t("Det du publicerar")}</h3>
        <ul>
          <li>
            {t("Publicera bara sådant du själv har sett, tagit eller skrivit, och beskriv det så sant du kan. Observationer används av andra för säkerhetsbeslut.")}
          </li>
          <li>
            {t("Inget olagligt, kränkande, hotfullt eller reklam. Lägg inte upp bilder där andra personer kan kännas igen utan deras lov, och inga personuppgifter om andra.")}
          </li>
          <li>
            {t("Du behåller rätten till det du publicerar. Du ger Snöläge rätt att utan ersättning lagra, visa och anpassa det (till exempel förminska bilder och dölja början och slutet av turer) i appen, så länge det ligger kvar. Raderar du det, eller ditt konto, upphör rätten.")}
          </li>
        </ul>

        <h3>{t("Anmälan och borttagning")}</h3>
        <p>
          {t("Den som är inloggad kan anmäla observationer, turer, delade rutter, kommentarer och profiler som bryter mot villkoren eller mot lag. Observationer och kommentarer döljs efter tre anmälningar tills en administratör har granskat dem; övrigt granskas av en administratör. Vi får ta bort innehåll som bryter mot villkoren eller mot lag, och stänga av konton som gör det upprepade gånger. Tar vi bort något du publicerat får du en notis om vad som togs bort och varför. Tycker du att det blev fel, mejla oss. Du kan också blockera någon från deras profil. Då ser ni inte längre varandras turer, observationer eller kommentarer och kan inte följa, kommentera eller gilla varandras inlägg.")}
        </p>

        <h3>{t("Ansvar och ändringar")}</h3>
        <p>
          {t("Snöläge tillhandahålls i befintligt skick, utan löfte om att tjänsten alltid fungerar eller att informationen är fullständig. I den utsträckning lagen tillåter ansvarar vi inte för skador som uppstår av att du använder appen eller litar på information i den. Vi kan ändra eller lägga ner tjänsten och ändra villkoren. Vid större ändringar meddelar vi det i appen. Svensk lag gäller.")}
        </p>
      </section>

      <section className="section privacy" id="integritet">
        <h2>{t("Integritetspolicy")}</h2>
        <p className="muted">{t("Senast uppdaterad 15 november 2026.")}</p>
        {isEnglish() && <p className="muted">This is a translation. The Swedish version of the privacy policy is the one that applies.</p>}
        <p>
          <strong>{t("Personuppgiftsansvarig")}</strong>{" "}{t("är Fabian Sund, som driver Snöläge som privatperson")}
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              (<a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>)
            </>
          )}
          .
        </p>
        <p>
          {t("Den här delen beskriver vilka personuppgifter Snöläge behandlar när du skapar ett konto och delar observationer och turer, och vilka rättigheter du har enligt dataskyddsförordningen (GDPR). Du kan använda prognoser, väder, karta och säkerhetsguide utan konto. Då sparar vi inga personuppgifter om dig.")}
        </p>

        <h3>{t("Vilka uppgifter vi sparar")}</h3>
        <ul>
          <li>
            <strong>{t("Konto:")}</strong>{" "}{t("e-postadress, användarnamn och ditt lösenord i krypterad (hashad) form. Vi kan aldrig se ditt lösenord. När du är inloggad sparas också vilka områden du stjärnmärkt, så att de följer med mellan dina enheter, och vilket språk du läser appen på, så att notiser och mejl kommer på samma språk.")}
          </li>
          <li>
            <strong>{t("Observationer:")}</strong>{" "}{t("det du själv publicerar, alltså typ, plats på kartan, tidpunkt, beskrivning och eventuell bild. Innan bilden laddas upp tar appen bort den inbäddade informationen, till exempel GPS-position och kameramodell. Saknas täckning när du skickar sparas observationen bara på din telefon tills den kan skickas, och du kan ta bort den där innan dess.")}
          </li>
          <li>
            <strong>{t("Turer:")}</strong>{" "}{t("GPS-spår du laddar upp (positioner, höjd och tidpunkter), med den titel och beskrivning du skriver. Turer är delade med andra som standard, men du kan göra en tur privat. För delade turer döljer vi som standard de första och sista 500 metrarna för andra, så att det inte syns var du bor eller parkerade. Du väljer själv avståndet, eller stänger av det.")}
          </li>
          <li>
            <strong>{t("Inspelade turer:")}</strong>{" "}{t("om du spelar in en tur i appen sparas GPS-punkterna (position, höjd, tidpunkt och noggrannhet) bara i din telefon eller webbläsare tills du sparar turen. Då skickas spåret till oss och behandlas som en uppladdad tur. I Android- och iPhone-appen fortsätter inspelningen när skärmen är släckt, och det syns med en notis (Android) eller den blå platsmarkeringen (iPhone). Slänger du inspelningen raderas den från telefonen. När du sparar hämtar appen markhöjder för spåret från Mapterhorn, så att höjdmetrarna blir rätt.")}
          </li>
          <li>
            <strong>{t("Health Connect (Android) och Apple Hälsa (iPhone):")}</strong>{" "}{t("om du kopplar Health Connect eller Apple Hälsa läser appen dina träningspass och deras GPS-rutter från den senaste månaden, aldrig puls, vikt eller annan hälsodata. Läsningen sker på telefonen. Bara de pass du själv väljer att importera skickas till oss, och de sparas som privata turer tills du väljer att dela dem. Slår du på automatisk import läggs nya skidpass till som privata turer när du öppnar appen eller går tillbaka till den. Slår du på \"Påminn mig om nya skidpass\" i appen kollar telefonen, även när appen är stängd, om det finns nya pass (Android ungefär en gång i timmen, iPhone när Apple Hälsa sparar ett nytt pass), och visar då en notis. Den kollen sker helt på telefonen och skickar ingenting till oss. Vi sparar passets id hos turen så att samma pass inte importeras två gånger. Uppgifter från Health Connect och Apple Hälsa används bara för din turdagbok: aldrig för reklam, de säljs inte och lämnas inte vidare till någon annan. Du kan sluta när som helst, i appen, i Health Connect eller i Apple Hälsa (Inställningar → Hälsa → Dataåtkomst och enheter).")}
          </li>
          <li>
            <strong>{t("Planerade rutter:")}</strong>{" "}{t("punkterna du klickar ut, namnet och ruttens längd och höjdmeter, om du väljer att spara rutten i ditt konto. Sparade rutter är privata. Väljer du \"Dela\" ser dina följare rutten i sitt flöde och den som har länken kan öppna den. Rutter som inte sparas finns bara på din enhet.")}
          </li>
          <li>
            <strong>{t("Planerade turdagar:")}</strong>{" "}{t("om du väljer en dag under \"Prognos inför din tur\" sparar vi området och datumet i ditt konto, för att kunna skicka dig prognosen för den dagen. Väljer du också en av dina sparade rutter sparar vi vilken, och en sammanfattning av den branta marken under den (väderstreck, höjd och längd), så att notisen kan jämföra rutten med prognosen. Bjuder du in någon du följer sparar vi inbjudan och svaret; den som går med får samma jämförelse och ser vilka mer som är med, men inte rutten själv. De tas bort en vecka efter dagen, eller när du tar bort dem, rutten eller ditt konto.")}
          </li>
          <li>
            <strong>{t("Dela position:")}</strong>{" "}{t("om du väljer \"Dela position\" skickar appen din position (koordinater, ungefärlig noggrannhet och tidpunkt) medan Snöläge är öppen – i Android- och iPhone-appen även i bakgrunden, så länge delningen pågår – och bara de du väljer – personer du följer eller har en turdag med – ser den. Vi sparar bara den senaste positionen, aldrig någon spårlogg, och raderar den när du stoppar delningen, loggar ut eller raderar kontot. Går tiden (högst 12 timmar) ut utan att du har stoppat delningen ligger den senaste positionen kvar i 24 timmar till för dem du valt, och de får en notis, ifall något har hänt. Du kan ta bort den själv när som helst. Den kommer aldrig med i säkerhetskopiorna. Vi använder den inte till något annat.")}
          </li>
          <li>
            <strong>{t("Följare, kommentarer och gilla:")}</strong>{" "}{t("vilka du följer, vilka som följer dig, och de kommentarer och gillamarkeringar du gör. Antalet följare syns för alla, men bara du ser vilka det är. Kommentarer syns för alla som kan se inlägget. Turer du delar med \"Bara de som följer mig\" syns bara för dina följare och finns inte med i värmekartan. Blockerar du någon sparar vi det tills du slutar blockera personen eller raderar kontot.")}
          </li>
          <li>
            <strong>{t("Notiser om ditt konto:")}</strong>{" "}{t("när någon följer dig, kommenterar, gillar eller svarar sparas en notis till dig (vem, vad och när). Notiser raderas efter 90 dagar. Slår du på \"Skicka notiserna till den här enheten\" sparar vi webbläsarens push-adress kopplad till ditt konto, tills du stänger av det.")}
          </li>
          <li>
            <strong>{t("Profilbild och erfarenhet:")}</strong>{" "}{t("om du lägger till en profilbild beskärs och komprimeras den i appen innan den laddas upp, vilket också tar bort inbäddad information som GPS-position. Bilden och din erfarenhetsnivå syns för alla. Nivån räknas fram ur antalet turer, höjdmeter och observationer du har – vi sparar inget extra för den.")}
          </li>
          <li>
            <strong>{t("Inloggning och säkerhet:")}</strong>{" "}{t("inloggningssessioner, tillfälliga länkar för att bekräfta e-post och återställa lösenord, samt anmälningar av inlägg (vem som anmälde vad). För att stoppa lösenordsgissning och skräpkonton räknar vi misslyckade inloggningar och nya konton per e-postadress och IP-adress. Det sparas bara i krypterad (hashad) form och raderas efter ett dygn.")}
          </li>
          <li>
            <strong>{t("Farogradsnotiser i webbläsaren:")}</strong>{" "}{t("om du slår på notiser för dina områden sparar vi den adress som din webbläsares push-tjänst (Google, Mozilla eller Apple) ger oss, och vilka områden du valt. Den kopplas inte till ditt konto. Notisernas innehåll skickas krypterat. Stänger du av notiserna raderas uppgifterna.")}
          </li>
          <li>
            <strong>{t("Notiser i mobilappen:")}</strong>{" "}{t("i Android- och iPhone-appen skickas notiser via Googles Firebase Cloud Messaging (till iPhone vidare via Apple). Slår du på notiser sparar vi telefonens notis-id från Firebase, om det är Android eller iPhone, vilka områden du valt och, bara om du slår på notiser för ditt konto, kopplingen till kontot. Notisens text (till exempel ny farograd eller vem som kommenterade) passerar Google och Apple på vägen till telefonen. Stänger du av notiserna raderas uppgifterna. Loggar du ut slutar telefonen få notiser om kontot.")}
          </li>
          <li>
            <strong>{t("På din enhet:")}</strong>{" "}{t("appen sparar din inloggning och senast hämtade prognoser och väder lokalt, så att den fungerar utan täckning. Vi använder inga kakor för spårning och ingen annonsering.")}
          </li>
          <li>
            <strong>{t("Tjänster som appen hämtar från direkt:")}</strong>{" "}{t("för väder hämtar appen data direkt från SMHI, för höjder och lutning från Mapterhorn, kartan över Norge från Kartverket, lutnings- och utlöpskartorna över Norge från NVE och utanför fjällen kan kartan hämtas från OpenStreetMap. Vid registrering kontrollerar Cloudflare Turnstile att du inte är en robot. De tjänsterna ser då din IP-adress, som vid vanlig surfning, men inget om ditt konto.")}
          </li>
          <li>
            <strong>{t("Besöksstatistik:")}</strong>{" "}{t("på webbplatsen snolage.se räknar Cloudflare Web Analytics besök och sidvisningar – vilken sida, varifrån du kom (t.ex. en länk på Instagram), land och typ av enhet och webbläsare – utan kakor och utan att känna igen dig mellan besök. Vi ser bara totaler, aldrig enskilda besökare. Apparna räknas inte.")}
          </li>
          <li>
            <strong>{t("Tekniska uppgifter:")}</strong>{" "}{t("vår leverantör Cloudflare behandlar din IP-adress tillfälligt för att kunna leverera sidan och skydda den mot attacker. Vi sparar den inte tillsammans med ditt konto.")}
          </li>
        </ul>

        <h3>{t("Varför och med vilken rätt")}</h3>
        <p>
          {t("Uppgifterna behövs för att du ska kunna ha ett konto, dela observationer och turer och få de notiser du slagit på, alltså för att fullgöra tjänsten du bett om (artikel 6.1 b i GDPR). E-postadressen används bara för bekräftelse, återställning av lösenord och viktiga meddelanden om ditt konto. Den säljs aldrig och används inte för marknadsföring.")}
        </p>
        <p>
          {t("Räkningen av inloggningsförsök, robotkontrollen vid registrering och hanteringen av anmälningar sker med stöd av vårt")}{" "}<strong>{t("berättigade intresse")}</strong>{" "}{t("av att skydda tjänsten och användarna mot intrång, skräpkonton och olämpligt innehåll (artikel 6.1 f). Du kan invända mot det, men utan dessa skydd kan vi inte erbjuda konton.")}
        </p>
        <p>{t("Besöksstatistiken på webbplatsen sker med stöd av vårt berättigade intresse av att se hur webbplatsen används och kunna förbättra den (artikel 6.1 f). Den innehåller inga kakor och kan inte kopplas till dig eller ditt konto.")}</p>

        <h3>{t("Vem som ser vad")}</h3>
        <p>
          {t("Dina observationer, dina delade turer och ditt användarnamn är")}{" "}<strong>{t("offentliga")}</strong>{" "}{t("för alla som använder appen. Privata turer ser bara du. Din e-postadress visas aldrig för andra. Vi delar inte dina uppgifter med någon annan än de tjänsteleverantörer som driver appen åt oss:")}
        </p>
        <ul>
          <li>
            <strong>{t("Cloudflare")}</strong>{t(": webbhotell, databas och lagring av bilder och GPS-spår. Databasen, bilderna och spåren lagras inom EU.")}
          </li>
          <li>
            <strong>{t("Resend")}</strong>{t(": utskick av e-post för bekräftelse och lösenordsåterställning.")}
          </li>
          <li>
            <strong>{t("Google (Firebase Cloud Messaging)")}</strong>{t(": leverans av notiser till mobilapparna, bara om du slår på notiser i appen. Notiser till iPhone går vidare via")}{" "}<strong>{t("Apple")}</strong>{t("s push-tjänst.")}
          </li>
        </ul>
        <p>
          {t("Alla är amerikanska företag. Överföringen till USA sker med stöd av EU:s och USA:s ramverk för dataskydd (EU–US Data Privacy Framework) och EU-kommissionens standardavtalsklausuler.")}
        </p>

        <h3>{t("Hur länge")}</h3>
        <p>
          {t("Kontot, dina observationer, turer, rutter och kommentarer sparas tills du raderar dem. Inloggningar går ut 90 dagar efter att de senast användes, länkar för att bekräfta e-post efter 24 timmar och länkar för lösenordsåterställning efter en timme. Notiser raderas efter 90 dagar och räkningen av inloggningsförsök efter ett dygn. Uppgifter för push-notiser sparas tills du stänger av notiserna, eller tills telefonen eller webbläsaren slutar ta emot dem. Anmälningar sparas tills de har hanterats, eller så länge det anmälda innehållet finns. Raderade uppgifter kan finnas kvar i databasens automatiska säkerhetskopior i upp till 30 dagar, och används inte under den tiden.")}
        </p>

        <h3 id="radera-konto">{t("Radera ditt konto")}</h3>
        <p>
          {t("Logga in, gå till din profil och tryck")}{" "}<strong>{t("Radera mitt konto")}</strong>{" "}{t("längst ner. Då tas kontot och allt du har lagt upp bort direkt och permanent: observationer, bilder, profilbild, turer, rutter, kommentarer, gillamarkeringar, följare och notiser. Det fungerar likadant på webben och i apparna.")}
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              {t("Kommer du inte åt kontot kan du mejla")}{" "}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>{" "}{t("från adressen du registrerade dig med, så raderar vi det åt dig.")}
            </>
          )}
        </p>

        <h3>{t("Dina rättigheter")}</h3>
        <p>
          {t("Du har rätt att få veta vilka uppgifter vi har om dig och få en kopia av dem, få dem rättade eller raderade, få ut det du själv lämnat i ett maskinläsbart format (dataportabilitet), begära att behandlingen begränsas och invända mot behandling som bygger på berättigat intresse. Vi svarar inom en månad. Du kan själv ta bort enskilda observationer, turer, rutter och kommentarer, och radera hela ditt konto, med allt du publicerat, från din profilsida. Raderingen sker direkt.")}
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              {t("För andra frågor, kontakta oss på")}{" "}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
            </>
          )}{" "}
          {t("Du kan också klaga hos")}{" "}
          <a href="https://www.imy.se" target="_blank" rel="noreferrer">
            {t("Integritetsskyddsmyndigheten (IMY)")}
          </a>
          .
        </p>
      </section>

      <section className="section">
        <h2>{t("Nödnummer")}</h2>
        <p className="safety-checklist__emergency">
          <strong>112</strong>
        </p>
      </section>
    </div>
  );
}
