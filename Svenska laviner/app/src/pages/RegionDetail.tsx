import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegionById } from "../data/regions";
import { fetchForecastHistory, loadForecasts, type HistoryDay } from "../services/avalancheService";
import DangerHistory from "../components/DangerHistory";
import FavoriteButton from "../components/FavoriteButton";
import OfflineMapCard from "../components/OfflineMapCard";
import TourCard from "../components/TourCard";
import { fetchTours } from "../services/tourService";
import type { Tour } from "../types/tour";
import { fetchWeather } from "../services/weatherService";
import type { AvalancheForecast } from "../types/avalanche";
import type { WeatherPoint } from "../types/weather";
import ForecastBadge from "../components/ForecastBadge";
import OfficialForecast from "../components/OfficialForecast";
import ObservationCard from "../components/ObservationCard";
import { fetchObservations } from "../services/observationService";
import type { Observation } from "../types/observation";
import DangerScaleGuide from "../components/DangerScaleGuide";
import SafetyChecklist from "../components/SafetyChecklist";
import ForecastProblems from "../components/ForecastProblems";
import SourceList from "../components/SourceList";
import WindRose from "../components/WindRose";
import { WindArrow } from "../components/CompassIcons";
import PageLoading from "../components/PageLoading";
import CollapsibleSection from "../components/CollapsibleSection";
import { usePageTitle } from "../components/pageTitle";
import { formatTime, symbolLabel, windCompass } from "../utils/weatherFormat";
import { withCache } from "../services/cache";
import {
  findNearestWindStation,
  fetchStationWindSeries,
  type WindStation,
  type WindSample,
} from "../services/windStationService";

export default function RegionDetail() {
  const { id = "" } = useParams();
  const region = getRegionById(id);
  usePageTitle(region?.name);

  const [forecast, setForecast] = useState<AvalancheForecast | null>(null);
  const [forecastStale, setForecastStale] = useState(false);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherCachedAt, setWeatherCachedAt] = useState<string | null>(null);
  const [weatherStale, setWeatherStale] = useState(false);

  const [station, setStation] = useState<WindStation | null>(null);
  const [stationSeries, setStationSeries] = useState<WindSample[] | null>(null);
  const [stationError, setStationError] = useState<string | null>(null);

  useEffect(() => {
    if (!region) return;
    fetchObservations({ region: region.id, limit: 5 })
      .then(setObservations)
      .catch(() => setObservations([]));

    fetchTours({ region: region.id, limit: 5 })
      .then(setTours)
      .catch(() => setTours([]));

    withCache(`forecast-history:${region.id}`, () => fetchForecastHistory(region.id))
      .then((result) => setHistory(result.data))
      .catch(() => setHistory([]));

    loadForecasts().then((result) => {
      setForecast(result.byId[region.id] ?? null);
      setForecastStale(result.stale);
    });

    withCache(`weather:${region.id}`, () => fetchWeather(region.lat, region.lon))
      .then((result) => {
        setWeather(result.data);
        setWeatherCachedAt(result.cachedAt);
        setWeatherStale(result.stale);
      })
      .catch((err) => setWeatherError(err.message));

    withCache(`wind-station:${region.id}`, async () => {
      const nearestStation = await findNearestWindStation(region.lat, region.lon);
      const series = await fetchStationWindSeries(nearestStation.id);
      return { station: nearestStation, series };
    })
      .then((result) => {
        setStation(result.data.station);
        setStationSeries(result.data.series);
      })
      .catch((err) => setStationError(err.message));
  }, [region]);

  if (!region) {
    return (
      <div className="page">
        <p>Området hittades inte.</p>
        <Link to="/">Tillbaka</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Alla områden
      </Link>
      <header className="page__header">
        <div className="page__title-row">
          <h1>{region.name}</h1>
          <FavoriteButton regionId={region.id} regionName={region.name} />
        </div>
        <p className="page__lead">{region.subAreas.join(" · ")}</p>
        {forecast ? (
          <ForecastBadge forecast={forecast} size="large" />
        ) : (
          <span className="skeleton skeleton--badge skeleton--badge-large" aria-label="Laddar farograd" />
        )}
      </header>

      {forecastStale && (
        <p className="notice notice--stale">Ingen kontakt just nu — visar senast sparade prognos.</p>
      )}
      {forecast && <OfficialForecast forecast={forecast} />}

      {history.some((d) => d.dangerLevel !== null) && (
        <section className="section">
          <h2>Senaste dagarna</h2>
          <DangerHistory
            days={history}
            today={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date())}
          />
          <p className="danger-history__note">Farograd enligt lavinprognoser.se, som Fjällkoll sparat dag för dag.</p>
        </section>
      )}

      {forecast && forecast.problems.length > 0 && (
        <section className="section">
          <h2>Lavinproblem</h2>
          <ForecastProblems problems={forecast.problems} />
        </section>
      )}

      <CollapsibleSection id="region-about" title="Om området">
        <p>{region.description}</p>
        <SourceList sources={region.sources} />
      </CollapsibleSection>

      <CollapsibleSection id="region-offline" title="Karta offline">
        <OfflineMapCard region={region} />
      </CollapsibleSection>

      <section className="section">
        <h2>Väder</h2>
        {weatherError && (
          <p className="notice" role="status">
            Väderprognosen från SMHI kunde inte hämtas just nu. Försök igen om en stund.
          </p>
        )}
        {!weather && !weatherError && (
          <div className="weather-table">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="weather-table__row">
                <span className="skeleton" style={{ width: 60, height: 14 }} />
                <span className="skeleton" style={{ width: 70, height: 14 }} />
                <span className="skeleton" style={{ width: 40, height: 14 }} />
                <span className="skeleton" style={{ width: 90, height: 14 }} />
              </div>
            ))}
          </div>
        )}
        {weatherStale && (
          <p className="notice notice--stale">
            Ingen kontakt just nu — visar sparad väderdata från{" "}
            {weatherCachedAt ? formatTime(weatherCachedAt) : "tidigare"}.
          </p>
        )}
        {weather && (
          <div className="weather-table">
            {weather
              .filter((_, i) => i % 3 === 0)
              .slice(0, 6)
              .map((w) => (
                <div key={w.time} className="weather-table__row">
                  <span className="weather-table__time">{formatTime(w.time)}</span>
                  <span>{symbolLabel(w.symbol)}</span>
                  <span>{w.temperature.toFixed(0)}°C</span>
                  <span className="weather-table__wind">
                    <WindArrow fromDegrees={w.windDirection} />
                    <span>
                      {w.windSpeed.toFixed(0)} m/s {windCompass(w.windDirection)}
                      {w.windGust > w.windSpeed + 3 ? ` (byar ${w.windGust.toFixed(0)})` : ""}
                    </span>
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {(weather || stationSeries || stationError) && (
        <section className="section">
          <h2>Vindanalys</h2>
          <p className="section__intro">
            Beräknad vindlast per väderstreck — vilken sida snön väntas läggas
            på av vinden. Ett förenklat mått (linjärt ovanför transportgränsen),
            inte en fysikalisk modell.
          </p>

          <div className="wind-subsection">
            <h3>Uppmätt, senaste dygnet</h3>
            {stationError && (
              <p className="notice" role="status">
                Uppmätt vind från SMHI:s stationer kunde inte hämtas just nu. Prognosen nedan fungerar ändå.
              </p>
            )}
            {!stationSeries && !stationError && <PageLoading label="Laddar mätdata…" />}
            {stationSeries && stationSeries.length === 0 && (
              <p className="section__intro">Ingen mätdata tillgänglig just nu.</p>
            )}
            {stationSeries && stationSeries.length > 0 && station && (
              <>
                <p className="section__intro">
                  Baserat på SMHI:s mätstation {station.name}, ~
                  {Math.round(station.distanceKm)} km bort.
                </p>
                <WindRose
                  readings={stationSeries}
                  sourceLabel="mätningen"
                  tableCaption="Vindlast per väderstreck (uppmätt, senaste dygnet)"
                />
              </>
            )}
          </div>

          {weather && (
            <div className="wind-subsection">
              <h3>Prognos, kommande timmar</h3>
              <WindRose
                readings={weather}
                sourceLabel="prognosen"
                tableCaption="Vindlast per väderstreck (senaste prognosen)"
              />
            </div>
          )}
        </section>
      )}

      <section className="section">
        <h2>Turer i området</h2>
        <p className="section__intro">Turer som andra åkare delat härifrån, senaste först.</p>
        {!tours && <PageLoading label="Laddar turer…" />}
        {tours && tours.length === 0 && <p className="section__intro">Inga delade turer från området än.</p>}
        <div className="tour-list">{tours?.map((t) => <TourCard key={t.id} tour={t} />)}</div>
        <p>
          <Link to="/turer" className="back-link">
            Alla turer →
          </Link>{" "}
          <Link to="/turer/ny" className="back-link">
            + Lägg till en tur
          </Link>
        </p>
      </section>

      <section className="section">
        <h2>Observationer i området</h2>
        <p className="section__intro">Senaste observationerna från andra åkare. Granskas inte i förväg.</p>
        {!observations && <PageLoading label="Laddar observationer…" />}
        {observations && observations.length === 0 && (
          <p className="section__intro">Inga observationer från området än.</p>
        )}
        <div className="observation-list">
          {observations?.map((o) => <ObservationCard key={o.id} observation={o} />)}
        </div>
        <p>
          <Link to="/observationer" className="back-link">
            Alla observationer →
          </Link>{" "}
          <Link to="/observationer/ny" className="back-link">
            + Dela en observation
          </Link>
        </p>
      </section>

      <CollapsibleSection id="region-scale" title="Lavinskalan">
        <DangerScaleGuide showHeading={false} />
      </CollapsibleSection>

      <section className="section">
        <SafetyChecklist />
      </section>
    </div>
  );
}
