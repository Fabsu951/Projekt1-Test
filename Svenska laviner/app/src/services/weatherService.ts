import type { WeatherPoint } from "../types/weather";

const SMHI_BASE = "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2";

interface SmhiParameter {
  name: string;
  values: number[];
}

interface SmhiTimeSeriesEntry {
  validTime: string;
  parameters: SmhiParameter[];
}

interface SmhiResponse {
  timeSeries: SmhiTimeSeriesEntry[];
}

function paramValue(entry: SmhiTimeSeriesEntry, name: string): number {
  return entry.parameters.find((p) => p.name === name)?.values[0] ?? 0;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherPoint[]> {
  const url = `${SMHI_BASE}/geotype/point/lon/${lon}/lat/${lat}/data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SMHI-anrop misslyckades: ${res.status}`);
  }
  const data: SmhiResponse = await res.json();

  return data.timeSeries.slice(0, 24).map((entry) => ({
    time: entry.validTime,
    temperature: paramValue(entry, "t"),
    windSpeed: paramValue(entry, "ws"),
    windGust: paramValue(entry, "gust"),
    windDirection: paramValue(entry, "wd"),
    precipitation: paramValue(entry, "pmean"),
    visibility: paramValue(entry, "vis"),
    symbol: paramValue(entry, "Wsymb2"),
  }));
}
