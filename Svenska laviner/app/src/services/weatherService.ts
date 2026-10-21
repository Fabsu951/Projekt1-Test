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

interface SmhiTimeSeriesEntry {
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
