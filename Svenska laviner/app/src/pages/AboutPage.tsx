export default function AboutPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Om appen</h1>
      </header>

      <div className="notice notice--danger">
        <strong>Fjällvarning ersätter inte officiell lavinprognos eller lavinutbildning.</strong>
        <p>
          Lavinfaran som visas i appen är, tills vidare, <strong>exempeldata</strong> och
          motsvarar inte verklig lavinfara. Innan du ger dig ut, kontrollera alltid den
          officiella prognosen på{" "}
          <a href="https://www.lavinprognoser.se" target="_blank" rel="noreferrer">
            lavinprognoser.se
          </a>{" "}
          (Naturvårdsverket).
        </p>
      </div>

      <section className="section">
        <h2>Vad appen gör</h2>
        <p>
          Fjällvarning samlar väderprognoser, en lavinskale-förklaring och en
          säkerhetsguide för svenska fjällens sex officiella lavinprognosområden på
          ett ställe, som ett komplement till — inte en ersättning för — de
          officiella källorna.
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

      <section className="section">
        <h2>Nödnummer</h2>
        <p className="safety-checklist__emergency">
          <strong>112</strong>
        </p>
      </section>
    </div>
  );
}
