import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { REGIONS } from "../../data/regions";
import { fetchForecastHistory, type HistoryDay } from "../../services/avalancheService";
import { cached, USER_SCOPE, withCache } from "../../services/cache";
import { fetchTrips, type TripPlan } from "../../services/tripService";
import type { AvalancheForecast } from "../../types/avalanche";
import { swedishDate } from "../../utils/today";
import DangerBadge from "../DangerBadge";
import ForecastBadge from "../ForecastBadge";
import { t } from "../../i18n";

interface Props {
  forecasts: Record<string, AvalancheForecast>;
  now: Date;
}

interface Shown {
  trip: TripPlan;
  when: "today" | "tomorrow";
}

/**
 * On a planned tour day (or the day before), the start page leads with it:
 * the area's published level, the route, who is coming and whether the map
 * is saved for use without coverage. Never a guessed level.
 */
export default function TodayTrip({ forecasts, now }: Props) {
  const { token } = useAuth();
  const [shown, setShown] = useState<Shown[]>([]);
  const [tomorrowLevels, setTomorrowLevels] = useState<Record<string, HistoryDay["dangerLevel"]>>({});
  const [offline, setOffline] = useState<Record<string, boolean>>({});
  const today = swedishDate(now);
  const tomorrow = swedishDate(now, 1);

  useEffect(() => {
    if (!token) return;
    let live = true;
    cached(`${USER_SCOPE}trips`, () => fetchTrips(token))
      .then((trips) => {
        if (!live) return;
        const list: Shown[] = [
          ...trips.filter((x) => x.date === today).map((trip) => ({ trip, when: "today" as const })),
          ...trips.filter((x) => x.date === tomorrow).map((trip) => ({ trip, when: "tomorrow" as const })),
        ];
        setShown(list);
        for (const { trip, when } of list) {
          // Loaded only when there is a planned day, so the start page stays small.
          void import("../../services/offlineMap")
            .then((m) => m.savedArea(trip.regionId))
            .then((area) => live && setOffline((o) => ({ ...o, [trip.regionId]: !!area })))
            .catch(() => undefined);
          if (when === "tomorrow") {
            withCache(`forecast-history:${trip.regionId}`, () => fetchForecastHistory(trip.regionId))
              .then((r) => {
                const day = r.data.find((d) => d.date === tomorrow);
                if (live) setTomorrowLevels((l) => ({ ...l, [trip.regionId]: day?.dangerLevel ?? null }));
              })
              .catch(() => undefined);
          }
        }
      })
      .catch(() => live && setShown([]));
    return () => {
      live = false;
    };
  }, [token, today, tomorrow]);

  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="today-trip" className="today-trip">
      <h2 id="today-trip" className="today__label">
        {shown[0].when === "today" ? t("Din tur idag") : t("Din tur imorgon")}
      </h2>
      {shown.map(({ trip, when }) => {
        const region = REGIONS.find((r) => r.id === trip.regionId);
        if (!region) return null;
        const forecast = forecasts[trip.regionId];
        const tomorrowLevel = tomorrowLevels[trip.regionId] ?? null;
        return (
          <article key={trip.id} className="today-trip__card">
            <div className="today-trip__head">
              <div>
                {shown.length > 1 && <p className="today-trip__when">{when === "today" ? t("Idag") : t("Imorgon")}</p>}
                <h3>
                  <Link to={`/omrade/${region.id}`}>{region.name}</Link>
                </h3>
              </div>
              {when === "today" && forecast && <ForecastBadge forecast={forecast} />}
              {when === "tomorrow" && tomorrowLevel !== null && <DangerBadge level={tomorrowLevel} />}
            </div>

            {when === "today" && forecast?.headline && <p className="today-trip__headline">{forecast.headline}</p>}
            {when === "tomorrow" && tomorrowLevel === null && (
              <p className="today-trip__headline">
                {t("Prognosen för imorgon publiceras runt kl 18 i kväll. Du får en notis när den kommer.")}
              </p>
            )}

            <ul className="today-trip__facts">
              {trip.routeTitle && (
                <li>
                  {t("Rutt:")}{" "}
                  {trip.routeId ? <Link to={`/karta?rutt=${trip.routeId}`}>{trip.routeTitle}</Link> : trip.routeTitle}
                </li>
              )}
              {(trip.invites ?? []).some((i) => i.status === "accepted") && (
                <li>
                  {t("Med dig:")}{" "}
                  {(trip.invites ?? [])
                    .filter((i) => i.status === "accepted")
                    .map((i) => i.user.displayName)
                    .join(", ")}
                </li>
              )}
              {(trip.company ?? []).length > 0 && (
                <li>
                  {t("Med dig:")} {(trip.company ?? []).map((p) => p.displayName).join(", ")}
                </li>
              )}
              {offline[trip.regionId] !== undefined && (
                <li className={offline[trip.regionId] ? "today-trip__ok" : "today-trip__todo"}>
                  {offline[trip.regionId] ? t("Kartan är sparad för användning utan täckning.") : t("Kartan är inte sparad offline än.")}
                </li>
              )}
            </ul>

            <Link to={`/omrade/${region.id}#turdag`} className="button today-trip__open">
              {t("Öppna turdagen")}
            </Link>
          </article>
        );
      })}
    </section>
  );
}
