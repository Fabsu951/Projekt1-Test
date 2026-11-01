import { COMPASS_SECTORS } from "./windAnalysis";
import { compass, t } from "../i18n";

// "Hitta åk": marks ground whose steepness and aspect fall inside the
// ranges the user picks (an idea from Jonas Edlund, 2026-11-01: find runs of
// e.g. 20–30° facing NE–SE in areas without guidebooks). Heights come from
// the same Mapterhorn tiles as the slope layer (1 m national height models).
// It shows terrain only – never where it is safe.

export interface TerrainFilter {
  /** Lowest steepness shown, degrees (inclusive). */
  min: number;
  /** Steepness shown below this, degrees (exclusive). */
  max: number;
  /** Aspects shown, N first, clockwise (N, NO, O, SO, S, SV, V, NV). */
  sectors: boolean[];
}

export const SLOPE_STEP = 5;
export const SLOPE_LIMIT = 60;
export const DEFAULT_FILTER: TerrainFilter = { min: 15, max: 25, sectors: COMPASS_SECTORS.map(() => true) };

/**
 * Steepness (degrees) and the way the ground faces downhill (degrees from
 * north, null on flat ground) from a 3×3 height window laid out the way
 * leaflet-relief passes it: index = (column + 1) · 3 + (row + 1), rows growing
 * southwards, `pixelM` metres between neighbours (Sobel operator).
 */
export function slopeAspect(win: ArrayLike<number>, pixelM: number): { slope: number; aspect: number | null } {
  const east = (win[6] + 2 * win[7] + win[8] - (win[0] + 2 * win[1] + win[2])) / (8 * pixelM);
  const south = (win[2] + 2 * win[5] + win[8] - (win[0] + 2 * win[3] + win[6])) / (8 * pixelM);
  const slope = (Math.atan(Math.hypot(east, south)) * 180) / Math.PI;
  if (east === 0 && south === 0) return { slope, aspect: null };
  // Downhill points against the rise: −east eastwards, +south northwards.
  const aspect = ((Math.atan2(-east, south) * 180) / Math.PI + 360) % 360;
  return { slope, aspect };
}

/** 0 = N … 7 = NV, each sector 45° wide around its direction. */
export function sectorOf(aspect: number): number {
  return Math.round((((aspect % 360) + 360) % 360) / 45) % 8;
}

export function allSectors(filter: TerrainFilter): boolean {
  return filter.sectors.every(Boolean);
}

export function matchesTerrain(filter: TerrainFilter, slope: number, aspect: number | null): boolean {
  if (slope < filter.min || slope >= filter.max) return false;
  if (allSectors(filter)) return true;
  return aspect !== null && filter.sectors[sectorOf(aspect)];
}

/** Keeps min < max inside 0…SLOPE_LIMIT when one end moves past the other. */
export function withRange(filter: TerrainFilter, end: "min" | "max", value: number): TerrainFilter {
  if (end === "min") {
    const min = Math.max(0, Math.min(SLOPE_LIMIT - SLOPE_STEP, value));
    return { ...filter, min, max: Math.max(filter.max, min + SLOPE_STEP) };
  }
  const max = Math.max(SLOPE_STEP, Math.min(SLOPE_LIMIT, value));
  return { ...filter, max, min: Math.min(filter.min, max - SLOPE_STEP) };
}

/** "NO–SO", "N, O–S", "alla väderstreck" or "inget väderstreck" (word joiners keep a run on one line). */
export function sectorSummary(sectors: boolean[]): string {
  if (sectors.every(Boolean)) return t("alla väderstreck");
  if (!sectors.some(Boolean)) return t("inget väderstreck");
  // Start right after an unselected sector, so a run across north stays whole.
  const start = (sectors.findIndex((on) => !on) + 1) % 8;
  const runs: Array<[number, number]> = [];
  for (let k = 0; k < 8; k++) {
    const i = (start + k) % 8;
    if (!sectors[i]) continue;
    const last = runs[runs.length - 1];
    if (last && (last[1] + 1) % 8 === i) last[1] = i;
    else runs.push([i, i]);
  }
  const name = (i: number) => compass(COMPASS_SECTORS[i]);
  runs.sort((x, y) => x[0] - y[0]);
  return runs.map(([a, b]) => (a === b ? name(a) : `${name(a)}\u2060–\u2060${name(b)}`)).join(", ");
}

const STORAGE_KEY = "fjallkoll:terrain-finder";

export function loadFilter(): TerrainFilter {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<TerrainFilter> | null;
    if (
      saved &&
      typeof saved.min === "number" &&
      typeof saved.max === "number" &&
      saved.min >= 0 &&
      saved.max <= SLOPE_LIMIT &&
      saved.min < saved.max &&
      Array.isArray(saved.sectors) &&
      saved.sectors.length === 8
    ) {
      return { min: saved.min, max: saved.max, sectors: saved.sectors.map(Boolean) };
    }
  } catch {
    // Unreadable or not available (private window): start from the default.
  }
  return DEFAULT_FILTER;
}

export function saveFilter(filter: TerrainFilter): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
  } catch {
    // Not remembered, e.g. in a private window; the layer still works.
  }
}
