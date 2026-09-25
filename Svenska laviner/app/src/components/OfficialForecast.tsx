import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";

interface Props {
  forecast: AvalancheForecast;
}

const UNAVAILABLE_TEXT =
  "Vi kunde inte hämta eller tolka den officiella prognosen just nu. Kontrollera alltid lavinprognoser.se innan du ger dig ut.";

const NO_FORECAST_TEXT: Record<ForecastStatus, string> = {
  published: UNAVAILABLE_TEXT,
  "season-over":
    "Prognossäsongen är slut. Naturvårdsverket publicerar lavinprognoser dagligen kl 18 från mitten av december till mitten av maj. Utanför säsong får du själv bedöma förhållandena.",
  "not-assessed": "Området är inte bedömt i dagens prognos. Gör en egen bedömning av förhållandena.",
  unavailable: UNAVAILABLE_TEXT,
};

/** The official forecast summary for a region, always linking to the source page. */
export default function OfficialForecast({ forecast }: Props) {
  const published = forecast.status === "published" && forecast.dangerLevel !== null;
  return (
    <div className={published ? "official-forecast" : "official-forecast official-forecast--none"}>
      {published ? (
        <>
          {forecast.headline && <p className="official-forecast__headline">{forecast.headline}</p>}
          {forecast.mainMessage && <p className="official-forecast__message">{forecast.mainMessage}</p>}
          {forecast.publishedText && (
            <p className="official-forecast__meta">Publicerad {forecast.publishedText}</p>
          )}
        </>
      ) : (
        <p>{NO_FORECAST_TEXT[forecast.status]}</p>
      )}
      <a className="official-forecast__link" href={forecast.sourceUrl} target="_blank" rel="noreferrer">
        {published ? "Läs hela prognosen på lavinprognoser.se →" : "Öppna lavinprognoser.se →"}
      </a>
    </div>
  );
}
