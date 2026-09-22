import { useEffect, useState } from "react";
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
import { formatTime, symbolLabel, windCompass } from "../utils/weatherFormat";
import { withCache } from "../services/cache";

export default function RegionDetail() {
  const { id = "" } = useParams();
  const region = getRegionById(id);

  const [forecast, setForecast] = useState<AvalancheForecast | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherCachedAt, setWeatherCachedAt] = useState<string | null>(null);
  const [weatherStale, setWeatherStale] = useState(false);

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
        <h1>{region.name}</h1>
        <p className="page__lead">{region.subAreas.join(" · ")}</p>
        {forecast && <DangerBadge level={forecast.dangerLevel} size="large" />}
      </header>

      {forecast?.isPlaceholder && (
        <div className="notice">{forecast.summary}</div>
      )}

      {forecast && forecast.problems.length > 0 && (
        <section className="section">
          <h2>Lavinproblem</h2>
          <AvalancheProblems problems={forecast.problems} />
        </section>
      )}

      <section className="section">
        <h2>Väder</h2>
        {weatherError && <p className="error">Kunde inte hämta väderdata: {weatherError}</p>}
        {!weather && !weatherError && <p>Laddar väderdata…</p>}
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

      <section className="section">
        <DangerScaleGuide />
      </section>

      <section className="section">
        <SafetyChecklist />
      </section>
    </div>
  );
}
