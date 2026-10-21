import { haversineDistanceKm } from "../utils/geo";
import { cached } from "./cache";
import { timedFetch } from "../utils/timedFetch";

/**
 * Measured snow depth from SMHI's observation network (metobs parameter 8,
 * "Snödjup, momentanvärde, 1 gång/dygn", in metres), for the stations
 * nearest an area. Same API as the wind stations (windStationService.ts);
 * not callable from the cloud sessions, so the response shape follows
 * SMHI's documentation — check a live answer if values ever look wrong.
 * Stations are usually in valleys and villages, so this says how much snow
 * there is around the area, not on the mountain.
 */
const METOBS_BASE = "https://opendata-download-metobs.smhi.se/api/version/1.0";
const SNOW_DEPTH_PARAMETER = 8;
const MAX_DISTANCE_KM = 60;
const MAX_STATIONS = 3;
/** Stations to try, nearest first, until MAX_STATIONS have a fresh value. */
const MAX_TRIED = 6;
/** A value older than this is not shown. */
const FRESH_MS = 3 * 864e5;
const CHANGE_DAYS = 3;

interface RawStation {
  id: number;
  name?: string;
  key?: string;
  latitude: number;
  longitude: number;
  height?: number;
  active?: boolean;
}

export interface RawValue {
  date: number;
  value: string;
}

export interface SnowStation {
  id: number;
  name: string;
  heightM: number | null;
  distanceKm: number;
  depthCm: number;
  measuredAt: string;
  /** Change since about three days earlier, or null without that value. */
  changeCm: number | null;
}

/** The latest fresh depth and its change over about three days, or null. */
export function summarizeDepth(values: RawValue[], now: Date): Pick<SnowStation, "depthCm" | "measuredAt" | "changeCm"> | null {
  const series = values
    .map((v) => ({ date: v.date, cm: Math.round(Number(v.value) * 100) }))
    .filter((v) => Number.isFinite(v.date) && Number.isFinite(v.cm) && v.cm >= 0)
    .sort((a, b) => a.date - b.date);
  const last = series.at(-1);
  if (!last || now.getTime() - last.date > FRESH_MS || last.date > now.getTime() + 3600e3) return null;
  // The value closest to three days before, if it is within half a day of that.
  const target = last.date - CHANGE_DAYS * 864e5;
  let earlier: { date: number; cm: number } | undefined;
  for (const v of series) {
    if (Math.abs(v.date - target) <= 12 * 3600e3 && (!earlier || Math.abs(v.date - target) < Math.abs(earlier.date - target))) earlier = v;
  }
  return { depthCm: last.cm, measuredAt: new Date(last.date).toISOString(), changeCm: earlier ? last.cm - earlier.cm : null };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchSnowDepth(lat: number, lon: number, now = new Date()): Promise<SnowStation[]> {
  const list = await getJson<{ station: RawStation[] }>(`${METOBS_BASE}/parameter/${SNOW_DEPTH_PARAMETER}.json`);
  const nearby = list.station
    .filter((s) => s.active !== false && Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map((s) => ({ s, distanceKm: haversineDistanceKm({ lat, lon }, { lat: s.latitude, lon: s.longitude }) }))
    .filter((c) => c.distanceKm <= MAX_DISTANCE_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_TRIED);
  const results = await Promise.all(
    nearby.map(async ({ s, distanceKm }): Promise<SnowStation | null> => {
      try {
        const data = await getJson<{ value?: RawValue[] }>(
          `${METOBS_BASE}/parameter/${SNOW_DEPTH_PARAMETER}/station/${s.id}/period/latest-months/data.json`
        );
        const summary = summarizeDepth(data.value ?? [], now);
        if (!summary) return null;
        return {
          id: s.id,
          name: s.name ?? s.key ?? `Station ${s.id}`,
          heightM: Number.isFinite(s.height) ? Math.round(s.height!) : null,
          distanceKm,
          ...summary,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is SnowStation => r !== null).slice(0, MAX_STATIONS);
}

/** Saved for use without coverage, like the other worker and SMHI answers. */
export function loadSnowDepth(regionId: string, lat: number, lon: number): Promise<SnowStation[]> {
  return cached(`snow-depth:${regionId}`, () => fetchSnowDepth(lat, lon));
}
