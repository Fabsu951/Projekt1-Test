export type CompassSector = "N" | "NO" | "O" | "SO" | "S" | "SV" | "V" | "NV";

/** Structurally compatible with WeatherPoint and WindSample alike. */
export interface WindReading {
  windSpeed: number;
  windDirection: number;
}

export const COMPASS_SECTORS: CompassSector[] = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];

/**
 * Below this speed, blowing/drifting snow transport is negligible for dry
 * snow (a commonly cited rule of thumb, not a precise physical threshold).
 * This whole module is a simplified heuristic — linear above the threshold —
 * not a physical saltation-transport model; it's meant to point at which
 * aspects are worth extra caution, not to quantify slab thickness.
 */
const TRANSPORT_THRESHOLD_MS = 6;

export interface SectorWindLoad {
  sector: CompassSector;
  /** Compass bearing this sector is centered on, 0-315 in 45° steps. */
  centerDegrees: number;
  /** Simplified relative loading index (m/s above threshold, summed). Not a physical unit. */
  loadIndex: number;
  hoursWithTransport: number;
}

function sectorIndex(directionDegrees: number): number {
  const normalized = ((directionDegrees % 360) + 360) % 360;
  return Math.round(normalized / 45) % 8;
}

/**
 * Buckets each forecast hour's wind into the compass sector it blows FROM,
 * then attributes loading to the opposite (leeward) sector — wind erodes
 * snow off the windward slope and deposits it on the slope it blows toward.
 * Based on forecast data, so this describes upcoming wind loading, not the
 * accumulated history of the existing snowpack.
 */
export function computeWindLoading(weather: WindReading[]): SectorWindLoad[] {
  const load = new Array(8).fill(0) as number[];
  const hours = new Array(8).fill(0) as number[];

  for (const point of weather) {
    if (point.windSpeed < TRANSPORT_THRESHOLD_MS) continue;
    const fromIndex = sectorIndex(point.windDirection);
    const leeIndex = (fromIndex + 4) % 8;
    load[leeIndex] += point.windSpeed - TRANSPORT_THRESHOLD_MS;
    hours[leeIndex] += 1;
  }

  return COMPASS_SECTORS.map((sector, i) => ({
    sector,
    centerDegrees: i * 45,
    loadIndex: Math.round(load[i] * 10) / 10,
    hoursWithTransport: hours[i],
  }));
}

export function mostLoadedSectors(loads: SectorWindLoad[], count = 2): SectorWindLoad[] {
  return [...loads]
    .filter((l) => l.loadIndex > 0)
    .sort((a, b) => b.loadIndex - a.loadIndex)
    .slice(0, count);
}
