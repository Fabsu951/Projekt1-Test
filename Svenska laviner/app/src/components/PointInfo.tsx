import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Popup, useMapEvents } from "react-leaflet";
import { REGIONS } from "../data/regions";
import type { AvalancheForecast } from "../types/avalanche";
import { ElevationSampler, type Terrain } from "../utils/elevation";
import { describeTerrain, weatherNow } from "../utils/mapPointInfo";
import { coordinateText, formatDecimal, formatSweref } from "../utils/coordinates";
import { nearestArea } from "../utils/terrainFinder";
import { SLOPE_BANDS, slopeBand } from "../utils/routePlan";
import { fetchWeather } from "../services/weatherService";
import { windCompass } from "../utils/weatherFormat";
import type { WeatherPoint } from "../types/weather";
import ForecastBadge from "./ForecastBadge";
import { locale, t } from "../i18n";

/** Leaflet can report one long press twice on touch screens (its own and the browser's); keep the first. */
const REPEAT_MS = 800;

/** An answer for the press made at `at`; an answer for an older press counts as still loading. */
type Load<T> = { at: number; state: "done"; value: T } | { at: number; state: "failed" };

interface Point {
  lat: number;
  lon: number;
  at: number;
}

/**
 * Long press on the map (right click on a computer): height, slope and aspect
 * of the ground there, its coordinates, SMHI's weather now and the area's
 * forecast – a level only when one is published.
 */
export default function PointInfo({ forecasts }: { forecasts: Record<string, AvalancheForecast> }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [terrainAnswer, setTerrain] = useState<Load<Terrain | null> | null>(null);
  const [weatherAnswer, setWeather] = useState<Load<WeatherPoint | null> | null>(null);
  const [copiedAt, setCopied] = useState<{ at: number; ok: boolean } | null>(null);
  const sampler = useRef<ElevationSampler | null>(null);

  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      const now = Date.now();
      setPoint((prev) => (prev && now - prev.at < REPEAT_MS ? prev : { lat: e.latlng.lat, lon: e.latlng.lng, at: now }));
    },
  });

  useEffect(() => {
    if (!point) return;
    let live = true;
    sampler.current ??= new ElevationSampler();
    const s = sampler.current;
    s.ready([[point.lat, point.lon]])
      .then(() => live && setTerrain({ at: point.at, state: "done", value: s.terrainSync(point.lat, point.lon) }))
      .catch(() => live && setTerrain({ at: point.at, state: "failed" }));
    fetchWeather(Number(point.lat.toFixed(4)), Number(point.lon.toFixed(4)))
      .then((series) => live && setWeather({ at: point.at, state: "done", value: weatherNow(series) }))
      .catch(() => live && setWeather({ at: point.at, state: "failed" }));
    return () => {
      live = false;
    };
  }, [point]);

  // A new array each render would make react-leaflet close and reopen the popup on every update.
  const position = useMemo<[number, number] | null>(() => (point ? [point.lat, point.lon] : null), [point]);

  if (!point || !position) return null;
  const area = nearestArea(point.lat, point.lon, REGIONS);
  const forecast = area ? forecasts[area.id] : undefined;
  const terrain = terrainAnswer?.at === point.at ? terrainAnswer : null;
  const weather = weatherAnswer?.at === point.at ? weatherAnswer : null;
  const copied = copiedAt?.at === point.at ? (copiedAt.ok ? "copied" : "failed") : "idle";
  const ground = terrain?.state === "done" ? terrain.value : null;

  async function copy() {
    if (!point) return;
    try {
      await navigator.clipboard.writeText(coordinateText(point.lat, point.lon));
      setCopied({ at: point.at, ok: true });
    } catch {
      setCopied({ at: point.at, ok: false });
    }
  }

  return (
    <Popup
      key={point.at}
      position={position}
      // Closed by the user (×, Esc, a tap elsewhere); a newer press replacing it leaves the new one alone.
      eventHandlers={{ remove: () => setPoint((p) => (p?.at === point.at ? null : p)) }}
      maxWidth={280}
      // Keeps it clear of the map's toolbar when the map pans to show it.
      autoPanPaddingTopLeft={[12, 76]}
    >
      <div className="point-info">
        {!terrain ? (
          <p className="muted">{t("Läser höjddata…")}</p>
        ) : ground ? (
          <>
            <p className="point-info__height">{t("{m} m ö.h.", { m: Math.round(ground.elevation).toLocaleString(locale()) })}</p>
            <p className="point-info__slope">
              {ground.slope >= 30 && (
                <span
                  className="point-info__swatch"
                  style={{ backgroundColor: SLOPE_BANDS[slopeBand(ground.slope)].color }}
                  aria-hidden="true"
                />
              )}
              {describeTerrain(ground)}
            </p>
          </>
        ) : (
          <p className="muted">{t("Höjddata kunde inte läsas här just nu.")}</p>
        )}

        <p className="point-info__coords">
          {formatDecimal(point.lat, point.lon)}
          <br />
          {t("SWEREF 99 TM")} {formatSweref(point.lat, point.lon)}
        </p>

        {weather?.state === "done" && weather.value && (
          <p>
            {t("Väder nu (SMHI): {temp}°, vind {wind} m/s från {dir}", {
              temp: Math.round(weather.value.temperature),
              wind: Math.round(weather.value.windSpeed),
              dir: windCompass(weather.value.windDirection),
            })}
            {weather.value.windGust > weather.value.windSpeed + 2 &&
              t(", byar {gust} m/s", { gust: Math.round(weather.value.windGust) })}
          </p>
        )}

        {area && forecast ? (
          <p className="point-info__forecast">
            <ForecastBadge forecast={forecast} />{" "}
            <Link to={`/omrade/${area.id}`}>{area.name}</Link>
          </p>
        ) : (
          <p className="muted">{t("Inget lavinprognosområde i närheten.")}</p>
        )}

        <button type="button" className="link-button" onClick={() => void copy()}>
          {copied === "copied" ? t("Kopierat") : copied === "failed" ? t("Kunde inte kopiera") : t("Kopiera koordinaterna")}
        </button>
        <p className="point-info__note">{t("Höjd och lutning från höjdmodellen, mätt över ca 60 m. Visar terrängen, inte lavinfaran.")}</p>
      </div>
    </Popup>
  );
}
