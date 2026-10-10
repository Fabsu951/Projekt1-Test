import AvalancheProblems from "../components/AvalancheProblems";
import DangerScaleGuide from "../components/DangerScaleGuide";
import SafetyChecklist from "../components/SafetyChecklist";
import SourceList from "../components/SourceList";
import { PROBLEM_LABELS } from "../data/avalancheProblems";
import type { AvalancheProblem, Source } from "../types/avalanche";
import { t } from "../i18n";

const ALL_PROBLEMS = Object.keys(PROBLEM_LABELS) as AvalancheProblem[];

const FJALLSAKERHETSRADET: Source = {
  label: "Fjällsäkerhetsrådet",
  url: "https://www.fjallsakerhetsradet.se/forbered-fjallturen/lavinsakerhet/",
};

const FJALLSAKERHETSRADET_FAKTA: Source = {
  label: "Fjällsäkerhetsrådet – Fakta om laviner",
  url: "https://www.fjallsakerhetsradet.se/vader-och-prognoser/fakta-om-laviner/",
};

const SMHI_LAVINER: Source = {
  label: "SMHI – Laviner",
  url: "https://www.smhi.se/kunskapsbanken/meteorologi/sno--och-isfenomen/laviner",
};

const EAWS_GLOSSARY: Source = {
  label: "EAWS – Glossary",
  url: "https://www.avalanches.org/glossary/",
};

const LAVINPROGNOSER_LAS_FORST: Source = {
  label: "lavinprognoser.se – Läs här först",
  url: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/las-har-forst/",
};

const LAVINPROGNOSER_PROBLEM: Source = {
  label: "lavinprognoser.se – Typer av lavinproblem",
  url: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/lavinproblem/",
};

const WEATHER_FACTORS = [
  {
    title: t("Nysnö"),
    text: t("Nysnö har lägre densitet än äldre snö och binder inte direkt till underlaget. Så mycket som 80 % av alla laviner sker inom ett dygn efter ett större snöfall, och risken kvarstår förhöjd i flera dagar efteråt."),
  },
  {
    title: t("Vind"),
    text: t("Vind flyttar snö även utan nederbörd. På läsidor byggs hårda, spröda vindflak upp — ofta den enskilt vanligaste orsaken till skidåkarutlösta laviner. Ju hårdare vind, desto snabbare och mer omfattande omlagring."),
  },
  {
    title: t("Temperatur"),
    text: t("Snabb temperaturhöjning, solvärme eller regn försvagar snötäcket och kan utlösa våtsnölaviner. Stora temperaturskillnader inne i snötäcket driver också omvandling som kan skapa nya svaga lager djupt nere."),
  },
];

const SNOWPACK_BASICS = [
  {
    title: t("Ytrimfrost (surface hoar)"),
    text: t("Bildas på kalla, klara och vindstilla nätter när fukt fryser direkt på snöytan, som frost på en bilruta. Om det snöar in ovanpå utan att rimfrosten bryts ner blir det ett svagt, glasartat lager djupt i snötäcket som kan hålla sig farligt i veckor."),
  },
  {
    title: t("Kantkorn och djuprimfrost (depth hoar)"),
    text: t("Uppstår genom en process som kallas temperaturgradient-metamorfos: stor temperaturskillnad mellan markvärme och kall yta får vattenånga att vandra genom snötäcket och bygga om kristallerna till lösa, kantiga korn med svag sammanhållning — vanligast vid tunt, tidigt snötäcke."),
  },
];

const STEEPNESS_LEVELS = [
  {
    range: "< 25°",
    risk: t("Låg"),
    note: t("Fjällsäkerhetsrådets rekommenderade gräns för säker skidåkning. De flesta laviner sker inte i så flack terräng, men var uppmärksam på brantare terräng ovanför dig."),
  },
  {
    range: "25–30°",
    risk: t("Ökande"),
    note: t("Fortfarande relativt säkert, men risken börjar öka och enstaka flaklaviner är möjliga."),
  },
  {
    range: "30–35°",
    risk: t("Ökande"),
    note: t("Här börjar flaklaviner bli möjliga. Vanlig terräng för skidåkning utanför pist."),
  },
  {
    range: "35–45°",
    risk: t("Hög"),
    note: t("Den brantaste terrängen där de flesta skidåkarutlösta laviner sker. Extra försiktighet krävs."),
  },
  {
    range: "> 45°",
    risk: t("Mycket hög"),
    note: t("Mycket brant terräng. Snön glider ofta av innan den hinner bygga upp stor spänning, men konsekvenserna av en lavin är extrema."),
  },
];

const TERRAIN_TRAPS = [
  t("Gryt, raviner och bäckfåror där lavinmassor samlas och begraver djupt"),
  t("Klippor och stup nedanför sluttningen"),
  t("Träd och stenblock som du kan slås mot"),
  t("Öppna vatten eller sjöisar nedanför sluttningen"),
  t("Konvexa (utbuktande) partier där snötäcket är extra spänt"),
];

const GOLDEN_RULES = [
  t("Ett i taget i brant terräng — övriga väntar på säker plats och observerar"),
  t("Håll avstånd i uppförsbacke och nedförsbacke i lavinterräng"),
  t("Undvik att korsa under någon annan i brant terräng"),
  t("Ändra plan om observationer inte stämmer med prognosen"),
  t("Enklaste vägen ner är ofta den säkraste — inte alltid den roligaste"),
];

export default function SafetyGuide() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Säkerhetsguide")}</h1>
        <p className="page__lead">
          {t("Grunderna i att läsa terräng och undvika lavinolyckor. Ersätter inte en lavinkurs — se den som en repetition, inte en utbildning.")}
        </p>
      </header>

      <section className="section">
        <h2>{t("Hur bildas laviner?")}</h2>
        <p>
          {t("Snötäcket byggs upp av lager som faller vid olika tillfällen och under olika väder. En lavin sker när ett övre lager inte längre håller ihop med det som ligger under — ofta på grund av ett svagt lager djupt nere som kan ligga kvar i veckor eller hela vintern.")}
        </p>
        <div className="avalanche-problems">
          {SNOWPACK_BASICS.map((item) => (
            <div key={item.title} className="avalanche-problems__item fact-card">
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
        <SourceList sources={[EAWS_GLOSSARY]} />
      </section>

      <section className="section">
        <h2>{t("Väder som ökar lavinrisken")}</h2>
        <p>
          {t("Tre väderfaktorer påverkar stabiliteten i snötäcket mer än några andra:")}
        </p>
        <div className="avalanche-problems">
          {WEATHER_FACTORS.map((item) => (
            <div key={item.title} className="avalanche-problems__item fact-card">
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
        <SourceList sources={[SMHI_LAVINER, FJALLSAKERHETSRADET_FAKTA]} />
      </section>

      <section className="section">
        <h2>{t("Branthet och lavinrisk")}</h2>
        <p>
          {t("Sluttningens lutning är en av de viktigaste faktorerna för lavinrisk. De flesta skidåkarutlösta flaklaviner sker i terräng brantare än 30°.")}
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
        <SourceList sources={[FJALLSAKERHETSRADET, { label: "lavinprognoser.se – Ordlista", url: "https://www.lavinprognoser.se/ordlista/" }]} />
      </section>

      <section className="section">
        <h2>{t("Terrängfällor")}</h2>
        <p>
          {t("En terrängfälla förvärrar konsekvenserna av en lavin, även en liten. Var extra vaksam kring:")}
        </p>
        <ul>
          {TERRAIN_TRAPS.map((trap) => (
            <li key={trap}>{trap}</li>
          ))}
        </ul>
        <SourceList sources={[FJALLSAKERHETSRADET]} />
      </section>

      <section className="section">
        <h2>{t("Tumregler i fält")}</h2>
        <ul>
          {GOLDEN_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <SourceList sources={[FJALLSAKERHETSRADET]} />
      </section>

      <section className="section">
        <h2>{t("Lavinproblemen")}</h2>
        <p className="section__intro">
          {t("Varje lavinprognos beskriver faran med ett eller flera av de här lavinproblemen, med samma namn som på lavinprognoser.se. Varje problem har sina egna typiska platser i terrängen och kräver olika sätt att undvika det.")}
        </p>
        <AvalancheProblems problems={ALL_PROBLEMS} />
      </section>

      <section className="section">
        <h2>{t("Så läser du lavinprognosen")}</h2>
        <p>
          {t("En officiell svensk lavinprognos (från Naturvårdsverket via lavinprognoser.se) består av flera delar som hör ihop:")}
        </p>
        <ul>
          <li>
            <strong>{t("Farograd (1–5)")}</strong>{" "}{t("— se lavinskalan nedan")}
          </li>
          <li>
            <strong>{t("Huvudbudskap")}</strong>{" "}{t("— en kort text som sammanfattar dagens viktigaste risk")}
          </li>
          <li>
            <strong>{t("Lavinproblem")}</strong>{" "}{t("— vilken typ av problem som är aktuell och var i terrängen den finns (se ovan)")}
          </li>
          <li>
            <strong>{t("Fjällväder")}</strong>{" "}{t("— dagens väderprognos för området")}
          </li>
          <li>
            <strong>{t("Utveckling")}</strong>{" "}{t("— hur risken väntas förändras de kommande dagarna")}
          </li>
        </ul>
        <p className="section__intro">
          {t("Farograden ensam säger inte var faran finns — det gör lavinproblemet. Läs alltid hela prognosen, inte bara siffran.")}
        </p>
        <SourceList sources={[LAVINPROGNOSER_LAS_FORST, LAVINPROGNOSER_PROBLEM]} />
        <DangerScaleGuide />
      </section>

      <section className="section">
        <h2>{t("Innan och under turen")}</h2>
        <SafetyChecklist />
      </section>
    </div>
  );
}
