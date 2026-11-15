import type { Terrain } from "./elevation";
import type { RouteSample } from "./routePlan";
import type { WeatherPoint } from "../types/weather";
import { sectorOf } from "./routeForecast";
import { windCompass } from "./weatherFormat";
import { compass, locale, t } from "../i18n";

// Small helpers for the map's point info (long press) and the route panel's weather.

/** Rows in the route weather table: every third hour for the next day. */
const STEP_H = 3;
const HOURS = 24;

/** "Lutning 32°, sluttar mot NO" or "Flack mark". */
export function describeTerrain(terrain: Terrain): string {
  const slope = Math.round(terrain.slope);
  if (terrain.aspect === null || slope < 3) return t("Flack mark");
  return t("Lutning {deg}°, sluttar mot {dir}", { deg: slope, dir: compass(sectorOf(terrain.aspect)) });
}

/** SMHI's forecast step nearest now. */
export function weatherNow(points: WeatherPoint[], now = Date.now()): WeatherPoint | null {
  let best: WeatherPoint | null = null;
  for (const p of points) {
    const d = Math.abs(Date.parse(p.time) - now);
    if (Number.isFinite(d) && (!best || d < Math.abs(Date.parse(best.time) - now))) best = p;
  }
  return best;
}

export interface Spot {
  lat: number;
  lon: number;
  elevation: number;
}

/** The highest and lowest point of the route, or null without heights. */
export function routeEnds(samples: RouteSample[]): { top: Spot; bottom: Spot } | null {
  let top: Spot | null = null;
  let bottom: Spot | null = null;
  for (const s of samples) {
    if (s.elevation === null) continue;
    const spot = { lat: s.lat, lon: s.lon, elevation: s.elevation };
    if (!top || s.elevation > top.elevation) top = spot;
    if (!bottom || s.elevation < bottom.elevation) bottom = spot;
  }
  return top && bottom ? { top, bottom } : null;
}

/** Forecast steps every STEP_H hours from now, for HOURS hours. */
export function pickSteps(points: WeatherPoint[], now = Date.now()): WeatherPoint[] {
  const out: WeatherPoint[] = [];
  let next = now - 30 * 60e3;
  for (const p of points) {
    const at = Date.parse(p.time);
    if (!Number.isFinite(at) || at < next) continue;
    if (at > now + HOURS * 3600e3) break;
    out.push(p);
    next = at + STEP_H * 3600e3;
  }
  return out;
}

/** "−8°, 12 (18) m/s V, 0,4 mm/h" */
export function weatherCell(p: WeatherPoint): string {
  const gust = p.windGust > p.windSpeed + 2 ? ` (${Math.round(p.windGust)})` : "";
  const rain = p.precipitation >= 0.1 ? `, ${p.precipitation.toLocaleString(locale(), { maximumFractionDigits: 1 })} mm/h` : "";
  return `${Math.round(p.temperature)}°, ${Math.round(p.windSpeed)}${gust} m/s ${windCompass(p.windDirection)}${rain}`;
}

