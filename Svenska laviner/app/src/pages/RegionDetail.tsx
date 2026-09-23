import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegionById } from "../data/regions";
import { fetchForecast } from "../services/avalancheService";
import { fetchWeather } from "../services/weatherService";
import type { AvalancheForecast } from "../types/avalanche";
import type { WeatherPoint } from "../types/weather";
import DangerBadge from "../components/DangerBadge";
import DangerScaleGuide from "../components/DangerScaleGuide";
import SafetyChecklist from "../components/SafetyChecklist";
import AvalancheProblems from "../components/AvalancheProblems";
import SourceList from "../components/SourceList";
import WindRose from "../components/WindRose";
import PageLoading from "../components/PageLoading";
import { formatTime, symbolLabel, windCompass } from "../utils/weatherFormat";
import { computeWindLoading, rawWindSummary } from "../utils/windAnalysis";
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

  const [forecast, setForecast] = useState<AvalancheForecast | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherCachedAt, setWeatherCachedAt] = useState<string | null>(null);
  const [weatherStale, setWeatherStale] = useState(false);

  const [station, setStation] = useState<WindStation | null>(null);
  const [stationSeries, setStationSeries] = useState<WindSample[] | null>(null);
  const [stationError, setStationError] = useState<string | null>(null);

  useEffect(() => {
    if (!region) return;
    fetchForecast(region.id).then(setForecast);

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

  const forecastWindLoading = useMemo(() => computeWindLoading(weather ?? []), [weather]);
  const observedWindLoading = useMemo(
    () => computeWindLoading(stationSeries ?? []),
    [stationSeries]
  );
  const forecastRawWind = useMemo(() => rawWindSummary(weather ?? []), [weather]);
  const observedRawWind = useMemo(() => rawWindSummary(stationSeries ?? []), [stationSeries]);

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
        <h1>{region.name}</h1>
        <p className="page__lead">{region.subAreas.join(" · ")}</p>
        {forecast ? (
          <DangerBadge level={forecast.dangerLevel} size="large" />
        ) : (
          <span className="skeleton skeleton--badge skeleton--badge-large" aria-label="Laddar farograd" />
        )}
      </header>

      {forecast?.isPlaceholder && (
        <div className="notice">{forecast.summary}</div>
      )}

      <section className="section">
        <h2>Om området</h2>
        <p>{region.description}</p>
        <SourceList sources={region.sources} />
      </section>

      {forecast && forecast.problems.length > 0 && (
        <section className="section">
          <h2>Lavinproblem</h2>
          <AvalancheProblems problems={forecast.problems} />
        </section>
      )}

      <section className="section">
        <h2>Väder</h2>
        {weatherError && <p className="error">Kunde inte hämta väderdata: {weatherError}</p>}
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
                  <span>
                    {w.windSpeed.toFixed(0)} m/s {windCompass(w.windDirection)}
                    {w.windGust > w.windSpeed + 3 ? ` (byar ${w.windGust.toFixed(0)})` : ""}
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
              <p className="error">Kunde inte hämta mätdata: {stationError}</p>
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
                  sectors={observedWindLoading}
                  sourceLabel="mätningen"
                  tableCaption="Vindlast per väderstreck (uppmätt, senaste dygnet)"
                  raw={observedRawWind}
                />
              </>
            )}
          </div>

          {weather && (
            <div className="wind-subsection">
              <h3>Prognos, kommande timmar</h3>
              <WindRose
                sectors={forecastWindLoading}
                sourceLabel="prognosen"
                tableCaption="Vindlast per väderstreck (senaste prognosen)"
                raw={forecastRawWind}
              />
            </div>
          )}
        </section>
      )}

      <section className="section">
        <DangerScaleGuide />
      </section>

      <section className="section">
        <SafetyChecklist />
      </section>
    </div>
  );
}
