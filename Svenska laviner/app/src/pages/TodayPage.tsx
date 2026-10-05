import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { REGIONS } from "../data/regions";
import { fetchForecastHistory, loadForecasts, type HistoryDay } from "../services/avalancheService";
import { withCache } from "../services/cache";
import { fetchObservations } from "../services/observationService";
import type { AvalancheForecast } from "../types/avalanche";
import type { Observation } from "../types/observation";
import { useFavorites } from "../favorites/useFavorites";
import AreaForecastCard from "../components/today/AreaForecastCard";
import OverviewMap from "../components/today/OverviewMap";
import QuickActions from "../components/today/QuickActions";
import RecentObservations from "../components/today/RecentObservations";
import NearestRegion from "../components/NearestRegion";
import PushToggle from "../components/PushToggle";
import ForecastBadge from "../components/ForecastBadge";
import FavoriteButton from "../components/FavoriteButton";

// The start page, "Idag i fjällen": today's forecast for your starred areas
// first, then quick actions, fresh observations, an overview map and the
// rest of the areas. Danger levels only ever come from the official forecast.

const OBSERVATION_DAYS = 7;
const SHOWN_OBSERVATIONS = 4;

function todayText(now: Date): string {
  const text = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function TodayPage() {
  const { favorites } = useFavorites();
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const [history, setHistory] = useState<Record<string, HistoryDay[]>>({});
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    loadForecasts().then((result) => {
      if (!live) return;
      setForecasts(result.byId);
      setStale(result.stale);
      setLoaded(true);
    });
    fetchObservations({ days: OBSERVATION_DAYS, limit: 50 })
      .then((list) => live && setObservations(list))
      .catch(() => live && setObservations([]));
    return () => {
      live = false;
    };
  }, []);

  const favoritesKey = favorites.join(",");
  useEffect(() => {
    let live = true;
    for (const id of favoritesKey ? favoritesKey.split(",") : []) {
      withCache(`forecast-history:${id}`, () => fetchForecastHistory(id))
        .then((r) => live && setHistory((h) => ({ ...h, [id]: r.data })))
        .catch(() => live && setHistory((h) => ({ ...h, [id]: [] })));
    }
    return () => {
      live = false;
    };
  }, [favoritesKey]);

  const list = Object.values(forecasts);
  const anyPublished = list.some((f) => f.status === "published");
  const offSeason = loaded && !anyPublished && list.some((f) => f.status === "season-over");
  const published = list.find((f) => f.status === "published" && f.publishedText)?.publishedText ?? null;

  const myObservations = useMemo(() => {
    if (!observations) return null;
    const mine = favorites.length > 0 ? observations.filter((o) => o.regionId && favorites.includes(o.regionId)) : observations;
    return mine.slice(0, SHOWN_OBSERVATIONS);
  }, [observations, favorites]);

  const others = REGIONS.filter((r) => !favorites.includes(r.id));

  return (
    <div className="page page--wide today">
      <header className="today__hello">
        <h1>Idag i fjällen</h1>
        <p>
          {todayText(now)}
          {published && ` · prognosen publicerad ${published}`}
        </p>
      </header>

      {stale && <p className="notice notice--stale">Ingen kontakt just nu. Visar senast sparade prognoser.</p>}
      {offSeason && (
        <div className="today-season">
          <strong>Ingen lavinprognos just nu.</strong>
          <p>
            Naturvårdsverket publicerar lavinprognoser från mitten av december till mitten av maj. Under tiden kan du läsa{" "}
            <Link to="/sakerhetsguide">säkerhetsguiden</Link>, planera turer på <Link to="/karta">kartan</Link> eller lägga in
            förra säsongens turer i <Link to="/turer">turdagboken</Link>.
          </p>
        </div>
      )}

      <div className="today__grid">
        <div className="today__main">
          <section aria-labelledby="today-mine">
            <h2 id="today-mine" className="today__label">
              Mina områden
            </h2>
            {favorites.length > 0 ? (
              <>
                {favorites.map((id) => {
                  const region = REGIONS.find((r) => r.id === id);
                  if (!region) return null;
                  return <AreaForecastCard key={id} region={region} forecast={forecasts[id]} history={history[id] ?? null} now={now} />;
                })}
                <PushToggle />
              </>
            ) : (
              <div className="today-empty">
                <p>
                  Tryck på <span aria-hidden="true">☆</span> stjärnan vid ett område, så hamnar det här med dagens prognos, trenden och
                  lavinproblemen.
                </p>
                <NearestRegion />
              </div>
            )}
          </section>

          <section aria-labelledby="today-quick">
            <h2 id="today-quick" className="today__label">
              Snabbval
            </h2>
            <QuickActions />
          </section>

          <section aria-labelledby="today-obs">
            <h2 id="today-obs" className="today__label">
              {favorites.length > 0 ? "Observationer i dina områden" : "Senaste observationerna"}
              <Link to="/observationer" className="today__label-link">
                Alla →
              </Link>
            </h2>
            <RecentObservations
              observations={myObservations}
              now={now}
              emptyText={`Inga observationer de senaste ${OBSERVATION_DAYS} dagarna${favorites.length > 0 ? " i dina områden" : ""}.`}
            />
          </section>
        </div>

        <aside className="today__side">
          <section aria-labelledby="today-map">
            <h2 id="today-map" className="today__label">
              Översikt
              <Link to="/karta" className="today__label-link">
                Öppna kartan →
              </Link>
            </h2>
            <OverviewMap forecasts={forecasts} favorites={favorites} />
          </section>

          {others.length > 0 && (
            <section aria-labelledby="today-others">
              <h2 id="today-others" className="today__label">
                {favorites.length > 0 ? "Övriga områden" : "Alla områden"}
              </h2>
              <ul className="today-panel today-areas">
                {others.map((region) => {
                  const f = forecasts[region.id];
                  return (
                    <li key={region.id} className="today-areas__row">
                      <Link to={`/omrade/${region.id}`} className="today-areas__link">
                        <span className="today-areas__name">
                          {region.name}
                          {f?.headline && <small>{f.headline}</small>}
                        </span>
                        {f ? <ForecastBadge forecast={f} /> : <span className="skeleton skeleton--badge" aria-label="Laddar farograd" />}
                      </Link>
                      <FavoriteButton regionId={region.id} regionName={region.name} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <p className="source-list">
            Farograder från Naturvårdsverkets{" "}
            <a href="https://www.lavinprognoser.se/" target="_blank" rel="noreferrer">
              lavinprognoser.se
            </a>
            . Läs alltid hela prognosen innan du ger dig ut.
          </p>
        </aside>
      </div>
    </div>
  );
}
