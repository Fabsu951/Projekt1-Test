import SafetyChecklist from "../components/SafetyChecklist";

const STEEPNESS_LEVELS = [
  {
    range: "< 30°",
    risk: "Låg",
    note: "De flesta laviner sker inte i så flack terräng, men var uppmärksam på terräng ovanför dig.",
  },
  {
    range: "30–35°",
    risk: "Ökande",
    note: "Här börjar flaklaviner bli möjliga. Vanlig terräng för skidåkning utanför pist.",
  },
  {
    range: "35–45°",
    risk: "Hög",
    note: "Den brantaste terrängen där de flesta skidåkarutlösta laviner sker. Extra försiktighet krävs.",
  },
  {
    range: "> 45°",
    risk: "Mycket hög",
    note: "Mycket brant terräng. Snön glider ofta av innan den hinner bygga upp stor spänning, men konsekvenserna av en lavin är extrema.",
  },
];

const TERRAIN_TRAPS = [
  "Gryt, raviner och bäckfåror där lavinmassor samlas och begraver djupt",
  "Klippor och stup nedanför sluttningen",
  "Träd och stenblock som du kan slås mot",
  "Öppna vatten eller sjöisar nedanför sluttningen",
  "Konvexa (utbuktande) partier där snötäcket är extra spänt",
];

const GOLDEN_RULES = [
  "Ett i taget i brant terräng — övriga väntar på säker plats och observerar",
  "Håll avstånd i uppförsbacke och nedförsbacke i lavinterräng",
  "Undvik att korsa under någon annan i brant terräng",
  "Ändra plan om observationer inte stämmer med prognosen",
  "Enklaste vägen ner är ofta den säkraste — inte alltid den roligaste",
];

export default function SafetyGuide() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Säkerhetsguide</h1>
        <p className="page__lead">
          Grunderna i att läsa terräng och undvika lavinolyckor. Ersätter inte en
          lavinkurs — se den som en repetition, inte en utbildning.
        </p>
      </header>

      <section className="section">
        <h2>Branthet och lavinrisk</h2>
        <p>
          Sluttningens lutning är en av de viktigaste faktorerna för lavinrisk. De
          flesta skidåkarutlösta flaklaviner sker i terräng brantare än 30°.
        </p>
        <div className="steepness-table">
          {STEEPNESS_LEVELS.map((level) => (
            <div key={level.range} className="steepness-table__row">
              <span className="steepness-table__range">{level.range}</span>
              <span className="steepness-table__risk">{level.risk}</span>
              <span className="steepness-table__note">{level.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Terrängfällor</h2>
        <p>
          En terrängfälla förvärrar konsekvenserna av en lavin, även en liten. Var
          extra vaksam kring:
        </p>
        <ul>
          {TERRAIN_TRAPS.map((trap) => (
            <li key={trap}>{trap}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Tumregler i fält</h2>
        <ul>
          {GOLDEN_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Innan och under turen</h2>
        <SafetyChecklist />
      </section>
    </div>
  );
}
