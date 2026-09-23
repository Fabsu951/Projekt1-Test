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
        <h1>Om appen</h1>
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
        <h2>Vad appen gör</h2>
        <p>
          Fjällkoll samlar väderprognoser, en lavinskale-förklaring och en
          säkerhetsguide för svenska fjällens sex officiella lavinprognosområden på
          ett ställe, som ett komplement till — inte en ersättning för — de
          officiella källorna. Inloggade användare kan också dela egna
          lavinobservationer med andra åkare.
        </p>
      </section>

      <section className="section">
        <h2>Vad appen inte gör</h2>
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
          konto och delar observationer, och vilka rättigheter du har enligt dataskyddsförordningen
          (GDPR). Du kan använda prognoser, väder, karta och säkerhetsguide utan konto. Då sparar vi
          inga personuppgifter om dig.
        </p>

        <h3>Vilka uppgifter vi sparar</h3>
        <ul>
          <li>
            <strong>Konto:</strong> e-postadress, användarnamn och ditt lösenord i krypterad (hashad)
            form. Vi kan aldrig se ditt lösenord.
          </li>
          <li>
            <strong>Observationer:</strong> det du själv publicerar, alltså typ, plats på kartan, tidpunkt,
            beskrivning och eventuell bild. Innan bilden laddas upp tar appen bort den inbäddade
            informationen, till exempel GPS-position och kameramodell.
          </li>
          <li>
            <strong>Inloggning och säkerhet:</strong> inloggningssessioner, tillfälliga länkar för att
            bekräfta e-post och återställa lösenord, samt anmälningar av inlägg (vem som anmälde vad).
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
          Dina observationer och ditt användarnamn är <strong>offentliga</strong> för alla som använder
          appen. Din e-postadress visas aldrig för andra. Vi delar inte dina uppgifter med någon
          annan än de tjänsteleverantörer som driver appen åt oss:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong>: webbhotell, databas och bildlagring.
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
          Kontot och dina observationer sparas tills du raderar dem. Inloggningar går ut efter 90 dagar,
          länkar för att bekräfta e-post efter 24 timmar och länkar för lösenordsåterställning efter en timme.
        </p>

        <h3>Dina rättigheter</h3>
        <p>
          Du har rätt att få veta vilka uppgifter vi har om dig, få dem rättade eller raderade, och
          invända mot behandlingen. Du kan själv ta bort enskilda observationer, och radera hela ditt
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
