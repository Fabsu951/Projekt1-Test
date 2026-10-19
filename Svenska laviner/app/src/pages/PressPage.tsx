import { useState } from "react";
import { Link } from "react-router-dom";
import { REGIONS } from "../data/regions";
import { PRESS_CONTACT_EMAIL } from "../data/contact";
import Contours from "../components/Contours";
import { isEnglish, t } from "../i18n";

// "Snöläge för press" (/press): texts ready to paste, facts, what to keep in
// mind when writing about an avalanche app, images to download and who to
// ask. The files live in public/presskit (made by scripts/presskit.mjs).

const KIT = "/presskit";

const SHORT_TEXT = t(
  "Snöläge är en gratis app som samlar Naturvårdsverkets lavinprognoser, SMHI:s väder och Lantmäteriets fjällkartor för den som åker skidor i de svenska fjällen.",
);

const LONG_TEXT = t(
  "Snöläge samlar det du behöver inför en tur i de svenska fjällen på ett ställe. Appen visar Naturvårdsverkets officiella lavinprognoser för sex fjällområden, med lavinproblemen och vad farograden betyder i praktiken. Till det kommer väder och vädervarningar från SMHI, snödjup från mätstationer och Lantmäteriets topografiska karta med lager för brant terräng. Du kan planera en rutt och jämföra den med dagens prognos, spara kartor för områden utan täckning, rapportera observationer som laviner och skjutsprickor, föra turdagbok och dela din position med turkamrater. Snöläge är gratis, finns på svenska och engelska och drivs av Fabian Sund. Appen gör inga egna bedömningar av lavinfaran.",
);

// Fabian's own words (2026-10-19), like the quotes below: only change them with him.
const BACKGROUND = t(
  "Jag heter Fabian Sund och kommer från början från Sandviken. Jag har åkt skidor i hela mitt liv och fastnade tidigt för turåkning och offpist, och jakten på den där känslan av frihet. De senaste tio åren har jag mest åkt i Jämtlandsfjällen och Södra Lapplandsfjällen. Jag har gått Lavinkurs grund, SVELAV Friåkning 1 (två dagar). Länge har jag saknat något som hjälper mig att få ut det mesta av mina turer och samtidigt hålla mig så säker som möjligt på fjället. Så jag bestämde mig för att göra något åt saken.",
);

// Approved by Fabian (2026-10-19); his words, so only change them with him.
const QUOTES = [
  t("Jag ville ha allt jag kollar inför och under en tur på ett ställe: prognosen, vädret och kartan. Snöläge ändrar ingenting i prognosen, det gör den bara lättare att läsa."),
  t("Appen kan aldrig ersätta sändare, spade, sond och utbildning. Den ska hjälpa dig att göra ett bättre beslut hemma, innan du åker."),
];

const GOOD_TO_KNOW = [
  t("Farograden i Snöläge är alltid Naturvårdsverkets officiella lavinprognos. Snöläge gör inga egna bedömningar av lavinfaran och är inte knutet till Naturvårdsverket."),
  t("När ingen prognos är publicerad visar Snöläge ingen farograd, bara att det saknas en."),
  t("Appen ersätter inte lavinutbildning, lavinutrustning (sändare, spade och sond) eller eget omdöme i fält."),
  t("Positionsdelningen är inget larm- eller räddningssystem och ersätter inte en lavinsändare. Vid en olycka: ring 112."),
];

const SHOTS: Array<[string, string]> = [
  ["1-idag", t("Startsidan: dagens läge i dina områden")],
  ["2-omrade", t("Ett område: farograd, prognos och råd")],
  ["3-rutt", t("Ruttplanering med brant terräng och höjdprofil")],
  ["4-tur", t("En tur i turdagboken")],
  ["5-observera", t("Snabbobservation i fält")],
  ["6-observationer", t("Observationer från andra åkare")],
];

function CopyText({ id, label, text }: { id: string; label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Without clipboard access the text can still be selected by hand.
    }
  }
  return (
    <div className="press-copy">
      <div className="press-copy__head">
        <h3 id={id}>{label}</h3>
        <button type="button" className="press-copy__button" aria-describedby={id} onClick={() => void copy()}>
          {copied ? t("Kopierad") : t("Kopiera texten")}
        </button>
      </div>
      <p className="press-copy__text">{text}</p>
    </div>
  );
}

export default function PressPage() {
  const lang = isEnglish() ? "en" : "sv";
  const other = lang === "sv" ? "en" : "sv";
  return (
    <div className="page press">
      <header className="page__header page__header--area press__header">
        <Contours />
        <h1>{t("Snöläge för press")}</h1>
        <p className="page__lead">
          {t("Texter, fakta och bilder för dig som skriver om Snöläge. Allt får användas fritt i artiklar och inslag om appen.")}
        </p>
        <p className="press__contact">
          {t("Frågor och intervjuer: Fabian Sund,")}{" "}
          <a href={`mailto:${PRESS_CONTACT_EMAIL}`}>{PRESS_CONTACT_EMAIL}</a>
        </p>
      </header>

      <section className="section">
        <h2>{t("Om Snöläge")}</h2>
        <CopyText id="press-short" label={t("En mening")} text={SHORT_TEXT} />
        <CopyText id="press-long" label={t("Ett stycke")} text={LONG_TEXT} />
      </section>

      <section className="section">
        <h2>{t("Bakgrund")}</h2>
        <CopyText id="press-background" label={t("Fabian Sund om varför Snöläge finns")} text={BACKGROUND} />
      </section>

      <section className="section">
        <h2>{t("Citat")}</h2>
        {QUOTES.map((quote) => (
          <figure key={quote} className="press-quote">
            <blockquote>
              <p>{t("”{quote}”", { quote })}</p>
            </blockquote>
            <figcaption>{t("Fabian Sund, som har gjort Snöläge")}</figcaption>
          </figure>
        ))}
      </section>

      <section className="section">
        <h2>{t("Bra att veta")}</h2>
        <ul className="press-points">
          {GOOD_TO_KNOW.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>{t("Fakta")}</h2>
        <dl className="press-facts">
          <div>
            <dt>{t("Vad")}</dt>
            <dd>{t("Lavinprognoser, väder, kartor och turplanering för skidåkning i de svenska fjällen")}</dd>
          </div>
          <div>
            <dt>{t("Områden")}</dt>
            <dd>{REGIONS.map((r) => r.name).join(", ")}</dd>
          </div>
          <div>
            <dt>{t("Pris")}</dt>
            <dd>{t("Gratis, utan reklam")}</dd>
          </div>
          <div>
            <dt>{t("Finns på")}</dt>
            <dd>
              <a href="https://snolage.se">snolage.se</a>
              {t(". Appen för Android testas nu inför Google Play, och en app för iPhone är på väg.")}
            </dd>
          </div>
          <div>
            <dt>{t("Språk")}</dt>
            <dd>{t("Svenska och engelska")}</dd>
          </div>
          <div>
            <dt>{t("Uppgifter från")}</dt>
            <dd>
              {t("Naturvårdsverket (lavinprognoser), SMHI (väder, vädervarningar och snödjup), Lantmäteriet (topografisk karta, CC BY 4.0), Mapterhorn (höjddata) och OpenStreetMap")}
            </dd>
          </div>
          <div>
            <dt>{t("Drivs av")}</dt>
            <dd>{t("Fabian Sund")}</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <h2>{t("Logotyp och ikon")}</h2>
        <ul className="press-logos">
          <li>
            <a href={`${KIT}/snolage-logotyp.png`} download className="press-logos__tile press-logos__tile--paper">
              <img src={`${KIT}/snolage-logotyp-liten.webp`} alt={t("Snöläges logotyp med mörk text")} width={260} height={76} />
            </a>
            <span>{t("För ljus bakgrund, PNG")}</span>
          </li>
          <li>
            <a href={`${KIT}/snolage-logotyp-vit.png`} download className="press-logos__tile press-logos__tile--night">
              <img src={`${KIT}/snolage-logotyp-vit-liten.webp`} alt={t("Snöläges logotyp med vit text")} width={260} height={76} />
            </a>
            <span>{t("För mörk bakgrund, PNG")}</span>
          </li>
          <li>
            <a href={`${KIT}/snolage-marke.svg`} download className="press-logos__tile press-logos__tile--paper">
              <img src={`${KIT}/snolage-marke.svg`} alt={t("Snöläges märke")} width={74} height={74} />
            </a>
            <span>{t("Märket, SVG")}</span>
          </li>
          <li>
            <a href={`${KIT}/snolage-appikon.png`} download className="press-logos__tile press-logos__tile--paper">
              <img src={`${KIT}/snolage-appikon.png`} alt={t("Snöläges appikon")} width={74} height={74} />
            </a>
            <span>{t("Appikonen, PNG 1024 px")}</span>
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>{t("Skärmbilder")}</h2>
        <p className="press__note">{t("Från telefonen, 1320 × 2868 px. Prognoserna, personerna och turerna på bilderna är exempel.")}</p>
        <ul className="press-shots">
          {SHOTS.map(([file, caption]) => (
            <li key={file}>
              <a href={`${KIT}/skarmbild-${lang}-${file}.jpg`} download>
                <img src={`${KIT}/skarmbild-${lang}-${file}-liten.webp`} alt={caption} width={180} height={391} loading="lazy" />
              </a>
              <span>{caption}</span>
              <a className="press-shots__other" href={`${KIT}/skarmbild-${other}-${file}.jpg`} download>
                {other === "en" ? t("På engelska") : t("På svenska")}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>{t("Mer om appen")}</h2>
        <p>
          {t("Hur Snöläge hämtar och visar uppgifterna, användarvillkor och integritetspolicy finns på")}{" "}
          <Link to="/om-appen">{t("Om Snöläge")}</Link>.
        </p>
      </section>
    </div>
  );
}
