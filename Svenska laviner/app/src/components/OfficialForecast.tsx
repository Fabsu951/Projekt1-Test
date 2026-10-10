import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";
import ForecastTrendLine from "./ForecastTrendLine";
import { t, isEnglish } from "../i18n";
import Icon from "./Icon";

interface Props {
  forecast: AvalancheForecast;
}

const UNAVAILABLE_TEXT =
  t("Vi kunde inte hämta eller tolka den officiella prognosen just nu. Kontrollera alltid lavinprognoser.se innan du ger dig ut.");

const NO_FORECAST_TEXT: Record<ForecastStatus, string> = {
  published: UNAVAILABLE_TEXT,
  "season-over":
    t("Prognossäsongen är slut. Naturvårdsverket publicerar lavinprognoser dagligen kl 18 från mitten av december till mitten av maj. Utanför säsong får du själv bedöma förhållandena."),
  "not-assessed": t("Området är inte bedömt i dagens prognos. Gör en egen bedömning av förhållandena."),
  spring:
    t("Vårförhållanden: lavinfaran varierar mycket under dagen och kan på kort tid öka när snötäcket värms upp. Färdas tidigt på dagen medan snön är frusen."),
  "no-danger": t("Ingen lavinfara enligt dagens prognos. Var ändå uppmärksam på förhållandena."),
  unavailable: UNAVAILABLE_TEXT,
};

/** The official forecast summary for a region, always linking to the source page. */
export default function OfficialForecast({ forecast }: Props) {
  const published = forecast.status === "published" && forecast.dangerLevel !== null;
  return (
    <div className={published ? "official-forecast" : "official-forecast official-forecast--none"}>
      {published ? (
        <>
          {forecast.headline && <p className="official-forecast__headline" lang="sv">{forecast.headline}</p>}
          {forecast.mainMessage && <p className="official-forecast__message" lang="sv">{forecast.mainMessage}</p>}
          {isEnglish() && (forecast.headline || forecast.mainMessage) && (
            <p className="official-forecast__meta">The forecast text is shown in Swedish, as published by Naturvårdsverket.</p>
          )}
          {forecast.trend && <ForecastTrendLine trend={forecast.trend} today={forecast.dangerLevel} />}
          {forecast.publishedText && (
            <p className="official-forecast__meta">{t("Publicerad")}{" "}{forecast.publishedText}</p>
          )}
        </>
      ) : (
        <>
          {(forecast.status === "spring" || forecast.status === "no-danger") && forecast.headline && (
            <p className="official-forecast__headline">{forecast.headline}</p>
          )}
          <p>{NO_FORECAST_TEXT[forecast.status]}</p>
          {(forecast.status === "spring" || forecast.status === "no-danger") && forecast.mainMessage && (
            <p className="official-forecast__message">{forecast.mainMessage}</p>
          )}
          {(forecast.status === "spring" || forecast.status === "no-danger") && forecast.trend && (
            <ForecastTrendLine trend={forecast.trend} today={null} />
          )}
        </>
      )}
      <a className="official-forecast__link" href={forecast.sourceUrl} target="_blank" rel="noreferrer">
        {published ? t("Läs hela prognosen på lavinprognoser.se") : t("Öppna lavinprognoser.se")}
        <Icon name="external" size={16} className="icon--link" />
      </a>
    </div>
  );
}
