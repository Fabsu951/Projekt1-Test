import { useEffect, useMemo, useState } from "react";
import { fetchWeatherSeries } from "../services/weatherService";
import type { WeatherPoint } from "../types/weather";
import { distanceM, type RouteSample } from "../utils/routePlan";
import { formatTime } from "../utils/weatherFormat";
import { pickSteps, routeEnds, weatherCell } from "../utils/mapPointInfo";
import { locale, t } from "../i18n";

/** SMHI's forecast squares are about 2.5 km; closer than this, top and bottom read the same square. */
const SAME_SQUARE_M = 2500;

const sameTime = (a: WeatherPoint[], time: string) => a.find((p) => p.time === time) ?? null;

/** SMHI's forecast at the route's highest and lowest point, in the route panel. */
export default function RouteWeather({ samples }: { samples: RouteSample[] }) {
  const ends = useMemo(() => routeEnds(samples), [samples]);
  const together = ends ? distanceM([ends.top.lat, ends.top.lon], [ends.bottom.lat, ends.bottom.lon]) < SAME_SQUARE_M : false;
  // Rounded to about 100 m, so moving a point slightly doesn't ask SMHI again.
  const key = ends
    ? [ends.top.lat, ends.top.lon, ends.bottom.lat, ends.bottom.lon].map((v) => v.toFixed(3)).join(",") + (together ? "1" : "2")
    : null;
  const [weather, setWeather] = useState<{ key: string; top: WeatherPoint[]; bottom: WeatherPoint[] } | "failed" | null>(null);

  useEffect(() => {
    if (!key) return;
    let live = true;
    const timer = window.setTimeout(() => {
      const [tLat, tLon, bLat, bLon] = key.slice(0, -1).split(",").map(Number);
      const top = fetchWeatherSeries(tLat, tLon);
      const bottom = together ? top : fetchWeatherSeries(bLat, bLon);
      Promise.all([top, bottom])
        .then(([tp, bt]) => live && setWeather({ key, top: pickSteps(tp), bottom: pickSteps(bt) }))
        .catch(() => live && setWeather("failed"));
    }, 600);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key, together]);

  if (!ends) return null;
  const height = (m: number) => t("{m} m", { m: Math.round(m).toLocaleString(locale()) });
  const ready = weather && weather !== "failed" && weather.key === key ? weather : null;
  const first = ready?.top[0];

  return (
    <section className="route-forecast route-weather">
      <h3>{together ? t("Väder längs rutten") : t("Väder på toppen och i botten")}</h3>
      {weather === "failed" || (ready && !first) ? (
        <p className="route-forecast__note">{t("Vädret kunde inte hämtas just nu.")}</p>
      ) : !ready || !first ? (
        <p className="route-forecast__note">{t("Hämtar SMHI:s prognos…")}</p>
      ) : (
        <>
          <dl className="route-weather__now">
            <div>
              <dt>{together ? t("Nu") : t("Toppen, {h}, nu", { h: height(ends.top.elevation) })}</dt>
              <dd>{weatherCell(first)}</dd>
            </div>
            {!together && ready.bottom[0] && (
              <div>
                <dt>{t("Botten, {h}, nu", { h: height(ends.bottom.elevation) })}</dt>
                <dd>{weatherCell(ready.bottom[0])}</dd>
              </div>
            )}
          </dl>
          <details className="route-weather__more">
            <summary>{t("Var tredje timme det närmaste dygnet")}</summary>
            <table className="route-weather__table">
              <thead>
                <tr>
                  <th scope="col">{t("Tid")}</th>
                  <th scope="col">{together ? t("Väder") : t("Toppen")}</th>
                  {!together && <th scope="col">{t("Botten")}</th>}
                </tr>
              </thead>
              <tbody>
                {ready.top.map((p) => {
                  const low = sameTime(ready.bottom, p.time);
                  return (
                    <tr key={p.time}>
                      <th scope="row">{formatTime(p.time)}</th>
                      <td>{weatherCell(p)}</td>
                      {!together && <td>{low ? weatherCell(low) : "–"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}
      <p className="route-forecast__note">
        {t("Temperatur, vind m/s (byar) och nederbörd från SMHI för rutor på ca 2,5 km. Prognosen räknar med rutans medelhöjd, så på en topp är det ofta kallare och blåsigare.")}
      </p>
    </section>
  );
}
