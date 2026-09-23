import { haversineDistanceKm } from "../utils/geo";

/**
 * SMHI's separate observation network (metobs), distinct from the forecast
 * API used elsewhere in the app. This gives real, measured historical wind
 * data from physical stations — unlike the forecast API, which only looks
 * forward. Mountain weather stations are sparse, so "nearest station" can
 * still be tens of kilometers away; the distance is surfaced in the UI so
 * the reading's relevance can be judged rather than assumed.
 *
 * Endpoint shapes (parameter 4 = vindhastighet/wind speed, 3 =
 * vindriktning/wind direction) confirmed against SMHI's own API docs
 * summaries and the open-source smhi-open-data client, not by a live call
 * from this environment (metobs.smhi.se is unreachable from here) — verify
 * against a real response if station data ever looks wrong in production.
 */
const METOBS_BASE = "https://opendata-download-metobs.smhi.se/api/version/1.0";
const WIND_SPEED_PARAMETER = 4;
const WIND_DIRECTION_PARAMETER = 3;

interface RawStation {
  id: number;
  name?: string;
  key?: string;
  latitude: number;
  longitude: number;
  active?: boolean;
}

interface RawStationListResponse {
  station: RawStation[];
}

interface RawValue {
  date: number;
  value: string;
}

interface RawObservationResponse {
  value: RawValue[];
}

export interface WindStation {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export interface WindSample {
  time: string;
  windSpeed: number;
  windDirection: number;
}

export async function findNearestWindStation(lat: number, lon: number): Promise<WindStation> {
  const res = await fetch(`${METOBS_BASE}/parameter/${WIND_SPEED_PARAMETER}.json`);
  if (!res.ok) {
    throw new Error(`Kunde inte hämta stationslistan: HTTP ${res.status}`);
  }
  const data: RawStationListResponse = await res.json();

  const candidates = data.station.filter(
    (s) => s.active !== false && Number.isFinite(s.latitude) && Number.isFinite(s.longitude)
  );
  if (candidates.length === 0) {
    throw new Error("Inga aktiva vindstationer hittades");
  }

  let nearest = candidates[0];
  let nearestDistance = haversineDistanceKm({ lat, lon }, { lat: nearest.latitude, lon: nearest.longitude });
  for (const station of candidates.slice(1)) {
    const distance = haversineDistanceKm({ lat, lon }, { lat: station.latitude, lon: station.longitude });
    if (distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }

  return {
    id: nearest.id,
    name: nearest.name ?? nearest.key ?? `Station ${nearest.id}`,
    lat: nearest.latitude,
    lon: nearest.longitude,
    distanceKm: nearestDistance,
  };
}

async function fetchParameterSeries(
  parameter: number,
  stationId: number
): Promise<Map<number, number>> {
  const url = `${METOBS_BASE}/parameter/${parameter}/station/${stationId}/period/latest-day/data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data: RawObservationResponse = await res.json();
  const series = new Map<number, number>();
  for (const entry of data.value) {
    const value = Number(entry.value);
    if (Number.isFinite(value)) {
      series.set(entry.date, value);
    }
  }
  return series;
}

export async function fetchStationWindSeries(stationId: number): Promise<WindSample[]> {
  const [speeds, directions] = await Promise.all([
    fetchParameterSeries(WIND_SPEED_PARAMETER, stationId),
    fetchParameterSeries(WIND_DIRECTION_PARAMETER, stationId),
  ]);

  const samples: WindSample[] = [];
  for (const [timestamp, windSpeed] of speeds) {
    const windDirection = directions.get(timestamp);
    if (windDirection !== undefined) {
      samples.push({ time: new Date(timestamp).toISOString(), windSpeed, windDirection });
    }
  }
  return samples.sort((a, b) => a.time.localeCompare(b.time));
}
