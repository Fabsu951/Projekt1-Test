import type { WeatherPoint } from "../types/weather";
import { t } from "../i18n";
import { timedFetch } from "../utils/timedFetch";

// SMHI retired the old pmp3g point-forecast API on 2026-03-31 in favor of
// snow1g (same lon/lat URL shape, but "validTime" became "time" and the
// {name, values} parameter array became a flat "data" object with renamed
// keys). Confirmed against multiple independent post-migration sources
// (the pysmhi client library and the Home Assistant SMHI integration's
// migration issue) since opendata.smhi.se's own docs are unreachable from
// this environment — verify against a live response if forecasts ever
// look wrong again.
const SMHI_BASE = "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1";

export interface SmhiTimeSeriesEntry {
  time: string;
  data: Record<string, number>;
}

interface SmhiResponse {
  timeSeries: SmhiTimeSeriesEntry[];
}

function paramValue(entry: SmhiTimeSeriesEntry, ...names: string[]): number {
  for (const name of names) {
    const value = entry.data[name];
    if (value !== undefined) return value;
  }
  return 0;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherPoint[]> {
  const url = `${SMHI_BASE}/geotype/point/lon/${lon}/lat/${lat}/data.json`;
  const res = await timedFetch(url);
  if (!res.ok) {
    throw new Error(t("SMHI-anrop misslyckades: {status}", { status: res.status }));
  }
  const data: SmhiResponse = await res.json();

  return data.timeSeries.slice(0, 24).map((entry) => ({
    time: entry.time,
    temperature: paramValue(entry, "air_temperature"),
    windSpeed: paramValue(entry, "wind_speed"),
    windGust: paramValue(entry, "wind_speed_of_gust"),
    windDirection: paramValue(entry, "wind_from_direction"),
    precipitation: paramValue(entry, "precipitation_amount_mean"),
    visibility: paramValue(entry, "visibility", "horizontal_visibility"),
    symbol: paramValue(entry, "symbol_code"),
  }));
}

export interface SnowfallOutlook {
  /** Precipitation expected to fall as snow, mm of water. */
  next24hMm: number;
  next72hMm: number;
}

/**
 * Snow expected in SMHI's forecast: each step's mean precipitation (mm/h)
 * times the step length times the frozen share (precipitation_frozen_part,
 * per cent; -9 = no precipitation). Checked against a live snow1g answer
 * 2026-11-09: hourly steps first, then 3, 6 and 12 hours.
 */
export function snowfallOutlook(series: SmhiTimeSeriesEntry[], now = new Date()): SnowfallOutlook | null {
  const start = now.getTime();
  const steps = series
    .map((e) => ({ at: Date.parse(e.time), data: e.data }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
  if (!steps.some((e) => e.at > start + 72 * 3600e3 - 12 * 3600e3)) return null;
  let next24hMm = 0;
  let next72hMm = 0;
  for (let i = 0; i < steps.length; i++) {
    const { at, data } = steps[i];
    if (at <= start || at > start + 72 * 3600e3) continue;
    // A value describes the time up to it, from the step before.
    const hours = i > 0 ? (at - steps[i - 1].at) / 3600e3 : 1;
    const rate = data.precipitation_amount_mean;
    const frozen = data.precipitation_frozen_part;
    if (typeof rate !== "number" || rate <= 0 || rate > 100 || typeof frozen !== "number" || frozen < 0) continue;
    const mm = rate * hours * Math.min(frozen, 100) / 100;
    next72hMm += mm;
    if (at <= start + 24 * 3600e3) next24hMm += mm;
  }
  return { next24hMm: Math.round(next24hMm * 10) / 10, next72hMm: Math.round(next72hMm * 10) / 10 };
}

/** Expected snow over the next three days at a point (a second, small request to the same SMHI forecast). */
export async function fetchSnowfall(lat: number, lon: number): Promise<SnowfallOutlook | null> {
  const res = await timedFetch(`${SMHI_BASE}/geotype/point/lon/${lon}/lat/${lat}/data.json`);
  if (!res.ok) throw new Error(t("SMHI-anrop misslyckades: {status}", { status: res.status }));
  const data: SmhiResponse = await res.json();
  return snowfallOutlook(data.timeSeries ?? []);
}
