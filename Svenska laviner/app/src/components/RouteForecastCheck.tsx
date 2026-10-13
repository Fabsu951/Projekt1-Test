import { Link } from "react-router-dom";
import ForecastBadge from "./ForecastBadge";
import { ELEVATION_LABELS } from "../data/elevations";
import type { AvalancheForecast } from "../types/avalanche";
import { formatDistance } from "../utils/tourFormat";
import { STEEP_DEG, type RouteForecastCheck as Check } from "../utils/routeForecast";
import { t, compass } from "../i18n";

const roundM = (m: number) => formatDistance(Math.max(25, Math.round(m / 25) * 25));

/**
 * The planned route next to today's official forecast for its area: which
 * steep stretches face the aspects, at the heights, where a problem is
 * found. Never says a route is safe; without a published forecast it says
 * so and compares nothing.
 */
export default function RouteForecastCheck({
  regionName,
  forecast,
  check,
}: {
  regionName: string | null;
  forecast: AvalancheForecast | null;
  check: Check | null;
}) {
  return (
    <div className="route-forecast">
      <h3>{t("Jämfört med dagens lavinprognos")}</h3>
      {!regionName ? (
        <p className="route-forecast__none">{t("Rutten ligger utanför lavinprognosområdena, så det finns ingen prognos att jämföra med.")}</p>
      ) : !forecast || forecast.status !== "published" || !check ? (
        <p className="route-forecast__none">
          {forecast && <ForecastBadge forecast={forecast} />}{" "}{t("Det finns ingen publicerad lavinprognos för")}{" "}{regionName}{" "}
          {t("just nu, så rutten kan inte jämföras.")}{" "}
          {forecast && (
            <a href={forecast.sourceUrl} target="_blank" rel="noreferrer">
              {t("Officiell prognos")}
            </a>
          )}
        </p>
      ) : (
        <>
          <p className="route-forecast__area">
            <ForecastBadge forecast={forecast} /> {regionName},{" "}
            <Link to={`/omrade/${check.regionId}`}>{t("hela prognosen")}</Link>
          </p>
          <ul className="route-forecast__list">
            {check.problems.map(({ problem, lengthM, sectors, bands }) => (
              <li key={problem.name} className={lengthM > 0 ? "route-forecast__item route-forecast__item--hit" : "route-forecast__item"}>
                <strong>{problem.name}:</strong>{" "}
                {lengthM > 0 ? (
                  <>
                    {t("rutten går över ca")}{" "}{roundM(lengthM)}{" "}{t("brant mark (över")}{" "}{STEEP_DEG}{t("°) som vetter mot")}{" "}
                    {sectors.map(compass).join(", ")}
                    {bands.length > 0 && ` – ${bands.map((b) => ELEVATION_LABELS[b].toLowerCase()).join(t(" och "))}`}
                    {t(", där prognosen anger problemet. Sträckorna är markerade på kartan.")}
                  </>
                ) : (
                  <>{t("ingen brant mark under rutten i prognosens väderstreck och höjder.")}</>
                )}
              </li>
            ))}
            {check.problems.length === 0 && <li className="route-forecast__item">{t("Prognosen anger inga lavinproblem i dag.")}</li>}
          </ul>
          <p className="route-forecast__note">
            {t("Jämförelsen gäller bara marken precis under linjen (")}{roundM(check.steepM)}{" "}{t("av rutten är brantare än")}{" "}
            {STEEP_DEG}{t("°). Sluttningar ovanför kan släppa laviner ner över rutten, och trädgränsen antas ligga kring")}{" "}
            {check.treelineM}{" "}{t("m här. Att inget markeras betyder inte att rutten är säker – läs prognosens text och gör din egen bedömning i fält.")}
          </p>
        </>
      )}
    </div>
  );
}
