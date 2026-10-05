import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PRIVACY_CONTACT_EMAIL } from "../data/contact";

export default function AboutPage() {
  const { hash } = useLocation();

  // Client-side navigation doesn't scroll to #anchors on its own.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Om Fjällkoll</h1>
        <p className="page__lead">
          Lavinläget, vädret och terrängen i de svenska fjällen samlat på ett ställe, för dig
          som åker skidor utanför pisten.
        </p>
      </header>

      <div className="notice notice--danger">
        <strong>Fjällkoll ersätter inte officiell lavinprognos eller lavinutbildning.</strong>
        <p>
          Farograderna hämtas automatiskt från den officiella prognosen och kan vara
          fördröjda eller, i sällsynta fall, feltolkade. Innan du ger dig ut, läs alltid hela
          den officiella prognosen på{" "}
          <a href="https://www.lavinprognoser.se" target="_blank" rel="noreferrer">
            lavinprognoser.se
          </a>{" "}
          (Naturvårdsverket).
        </p>
      </div>

      <section className="section">
        <h2>Vad Fjällkoll gör</h2>
        <p>
          Fjällkoll är ett komplement till de officiella källorna, inte en ersättning för dem. För
          de sex officiella lavinprognosområdena i svenska fjällen får du:
        </p>
        <ul>
          <li>
            <strong>Farograd</strong> från den officiella lavinprognosen, med länk till hela
            prognosen
          </li>
          <li>
            <strong>Väder och vind</strong> från SMHI, med uppskattning av vilka sluttningar som
            kan vara vindlastade
          </li>
          <li>
            <strong>Karta</strong> med Lantmäteriets topografiska karta och lager som visar hur
            brant terrängen är
          </li>
          <li>
            <strong>Observationer</strong> från andra åkare: skapa ett konto för att dela vad du
            själv ser i fjällen
          </li>
          <li>
            <strong>Säkerhetsguide</strong> med grunderna om snötäcket, lavinproblemen och
            lavinskalan
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>Vad Fjällkoll inte gör</h2>
        <ul>
          <li>Ersätter inte lavinutbildning eller erfarenhet i fjällterräng</li>
          <li>Ersätter inte ett dagligt beslut baserat på den officiella lavinprognosen</li>
          <li>Fattar inga beslut åt dig — du ansvarar alltid själv för din säkerhet</li>
        </ul>
      </section>

      <section className="section">
        <h2>Källor</h2>
        <ul>
          <li>
            Väderprognos och uppmätt vinddata:{" "}
            <a href="https://www.smhi.se" target="_blank" rel="noreferrer">SMHI</a>{" "}
            öppna data
          </li>
          <li>
            Lavinprognoser: <a href="https://www.lavinprognoser.se" target="_blank" rel="noreferrer">
              Naturvårdsverket
            </a>
          </li>
          <li>
            Topografisk karta: <a href="https://www.lantmateriet.se/" target="_blank" rel="noreferrer">
              Lantmäteriet
            </a>{" "}
            (Topografisk webbkarta Visning, översiktlig), CC0
          </li>
          <li>
            Terränglutning: höjddata (SRTM/NASADEM, ~30 m upplösning) från{" "}
            <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noreferrer">
              Mapterhorn
            </a>
          </li>
        </ul>
      </section>

      <section className="section privacy" id="integritet">
        <h2>Integritetspolicy</h2>
        <p>
          Den här delen beskriver vilka personuppgifter Fjällkoll behandlar när du skapar ett
          konto och delar observationer och turer, och vilka rättigheter du har enligt dataskyddsförordningen
          (GDPR). Du kan använda prognoser, väder, karta och säkerhetsguide utan konto. Då sparar vi
          inga personuppgifter om dig.
        </p>

        <h3>Vilka uppgifter vi sparar</h3>
        <ul>
          <li>
            <strong>Konto:</strong> e-postadress, användarnamn och ditt lösenord i krypterad (hashad)
            form. Vi kan aldrig se ditt lösenord. När du är inloggad sparas också vilka områden du
            stjärnmärkt, så att de följer med mellan dina enheter.
          </li>
          <li>
            <strong>Observationer:</strong> det du själv publicerar, alltså typ, plats på kartan, tidpunkt,
            beskrivning och eventuell bild. Innan bilden laddas upp tar appen bort den inbäddade
            informationen, till exempel GPS-position och kameramodell.
          </li>
          <li>
            <strong>Turer:</strong> GPS-spår du laddar upp (positioner, höjd och tidpunkter), med den
            titel och beskrivning du skriver. Turer är delade med andra som standard, men du kan göra
            en tur privat. För delade turer döljer vi som standard de första och sista 500 metrarna för
            andra, så att det inte syns var du bor eller parkerade. Du väljer själv avståndet, eller
            stänger av det.
          </li>
          <li>
            <strong>Planerade rutter:</strong> punkterna du klickar ut, namnet och ruttens längd och höjdmeter, om du
            väljer att spara rutten i ditt konto. Sparade rutter är privata. Väljer du "Dela" ser dina följare rutten i
            sitt flöde och den som har länken kan öppna den. Rutter som inte sparas finns bara på din enhet.
          </li>
          <li>
            <strong>Följare, kommentarer och gilla:</strong> vilka du följer, vilka som följer dig, och de
            kommentarer och gillamarkeringar du gör. Antalet följare syns för alla, men bara du ser vilka det
            är. Kommentarer syns för alla som kan se inlägget. Turer du delar med "Bara de som följer mig" syns
            bara för dina följare och finns inte med i värmekartan.
          </li>
          <li>
            <strong>Notiser:</strong> när någon följer dig, kommenterar, gillar eller svarar sparas en notis till dig
            (vem, vad och när). Notiser raderas efter 90 dagar. Slår du på "Skicka notiserna till den här enheten"
            sparar vi webbläsarens push-adress kopplad till ditt konto, tills du stänger av det.
          </li>
          <li>
            <strong>Profilbild och erfarenhet:</strong> om du lägger till en profilbild beskärs och komprimeras den
            i appen innan den laddas upp, vilket också tar bort inbäddad information som GPS-position. Bilden och din
            erfarenhetsnivå syns för alla. Nivån räknas fram ur antalet turer, höjdmeter och observationer du har –
            vi sparar inget extra för den.
          </li>
          <li>
            <strong>Inloggning och säkerhet:</strong> inloggningssessioner, tillfälliga länkar för att
            bekräfta e-post och återställa lösenord, samt anmälningar av inlägg (vem som anmälde vad).
            För att stoppa lösenordsgissning och skräpkonton räknar vi misslyckade inloggningar och nya
            konton per e-postadress och IP-adress. Det sparas bara i krypterad (hashad) form och raderas
            efter ett dygn.
          </li>
          <li>
            <strong>Notiser:</strong> om du slår på notiser för dina områden sparar vi den adress som din
            webbläsares push-tjänst (Google, Mozilla eller Apple) ger oss, och vilka områden du valt. Den
            kopplas inte till ditt konto. Notisernas innehåll skickas krypterat. Stänger du av notiserna
            raderas uppgifterna.
          </li>
          <li>
            <strong>På din enhet:</strong> appen sparar din inloggning och senast hämtade prognoser och
            väder lokalt, så att den fungerar utan täckning. Vi använder inga kakor för spårning, ingen
            annonsering och ingen analys av hur du använder appen.
          </li>
          <li>
            <strong>Tekniska uppgifter:</strong> vår leverantör Cloudflare behandlar din IP-adress
            tillfälligt för att kunna leverera sidan och skydda den mot attacker. Vi sparar den inte
            tillsammans med ditt konto.
          </li>
        </ul>

        <h3>Varför och med vilken rätt</h3>
        <p>
          Uppgifterna behövs för att du ska kunna ha ett konto och dela observationer, alltså för att
          fullgöra tjänsten du bett om (artikel 6.1 b i GDPR). E-postadressen används bara för
          bekräftelse, återställning av lösenord och viktiga meddelanden om ditt konto. Den säljs
          aldrig och används inte för marknadsföring.
        </p>

        <h3>Vem som ser vad</h3>
        <p>
          Dina observationer, dina delade turer och ditt användarnamn är <strong>offentliga</strong> för
          alla som använder appen. Privata turer ser bara du. Din e-postadress visas aldrig för andra. Vi delar inte dina uppgifter med någon
          annan än de tjänsteleverantörer som driver appen åt oss:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong>: webbhotell, databas och lagring av bilder och GPS-spår. Databasen,
            bilderna och spåren lagras inom EU.
          </li>
          <li>
            <strong>Resend</strong>: utskick av e-post för bekräftelse och lösenordsåterställning.
          </li>
        </ul>
        <p>
          Båda är amerikanska företag. Överföringen till USA sker med stöd av EU:s och USA:s
          ramverk för dataskydd (EU–US Data Privacy Framework) och EU-kommissionens standardavtalsklausuler.
        </p>

        <h3>Hur länge</h3>
        <p>
          Kontot, dina observationer, turer, rutter och kommentarer sparas tills du raderar dem. Inloggningar går ut efter 90 dagar,
          länkar för att bekräfta e-post efter 24 timmar och länkar för lösenordsåterställning efter en timme.
        </p>

        <h3 id="radera-konto">Radera ditt konto</h3>
        <p>
          Logga in, gå till din profil och tryck <strong>Radera mitt konto</strong> längst ner. Då tas kontot och allt
          du har lagt upp bort direkt och permanent: observationer, bilder, profilbild, turer, rutter, kommentarer,
          gillamarkeringar, följare och notiser. Det fungerar likadant på webben och i apparna.
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              Kommer du inte åt kontot kan du mejla{" "}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> från adressen du registrerade
              dig med, så raderar vi det åt dig.
            </>
          )}
        </p>

        <h3>Dina rättigheter</h3>
        <p>
          Du har rätt att få veta vilka uppgifter vi har om dig, få dem rättade eller raderade, och
          invända mot behandlingen. Du kan själv ta bort enskilda observationer, turer, rutter och kommentarer, och radera hela ditt
          konto, med allt du publicerat, från din profilsida. Raderingen sker direkt.
          {PRIVACY_CONTACT_EMAIL && (
            <>
              {" "}
              För andra frågor, kontakta oss på{" "}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
            </>
          )}{" "}
          Du kan också klaga hos{" "}
          <a href="https://www.imy.se" target="_blank" rel="noreferrer">
            Integritetsskyddsmyndigheten (IMY)
          </a>
          .
        </p>
      </section>

      <section className="section">
        <h2>Nödnummer</h2>
        <p className="safety-checklist__emergency">
          <strong>112</strong>
        </p>
      </section>
    </div>
  );
}
