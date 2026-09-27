// GPS tracks for the tour diary. The app parses GPX/FIT files and sends a
// simplified list of points; the worker validates them and derives the
// numbers itself, so stats are computed one way for everyone.

/** [latitude, longitude, elevation in metres or null, time in ms or null] */
export type TrackPoint = [number, number, number | null, number | null];

export const MAX_POINTS = 5000;
/** Elevation changes smaller than this are GPS/barometer noise, not climbing. */
const ASCENT_THRESHOLD_M = 5;

export interface TrackStats {
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxElevationM: number | null;
  startedAt: string | null;
  durationS: number | null;
}

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceM(a: TrackPoint, b: TrackPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLon = (b[1] - a[1]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Well-formed points only; throws with a message for the user if too few are left. */
export function cleanPoints(raw: unknown): TrackPoint[] {
  if (!Array.isArray(raw)) throw new Error("Spåret saknar punkter.");
  if (raw.length > MAX_POINTS) throw new Error(`Spåret har för många punkter (högst ${MAX_POINTS}).`);
  const points: TrackPoint[] = [];
  for (const p of raw) {
    if (!Array.isArray(p)) continue;
    const [lat, lon, ele, t] = p;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const elevation = typeof ele === "number" && Number.isFinite(ele) && ele > -500 && ele < 9000 ? ele : null;
    const time = typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null;
    points.push([lat, lon, elevation, time]);
  }
  if (points.length < 2) throw new Error("Spåret behöver minst två giltiga punkter.");
  return points;
}

export function trackStats(points: TrackPoint[]): TrackStats {
  let distance = 0;
  for (let i = 1; i < points.length; i++) distance += distanceM(points[i - 1], points[i]);

  // Hysteresis: only count a climb/descent once it exceeds the threshold.
  let ascent = 0;
  let descent = 0;
  let reference: number | null = null;
  let maxElevation: number | null = null;
  for (const [, , ele] of points) {
    if (ele === null) continue;
    maxElevation = maxElevation === null ? ele : Math.max(maxElevation, ele);
    if (reference === null) {
      reference = ele;
      continue;
    }
    const diff = ele - reference;
    if (diff >= ASCENT_THRESHOLD_M) {
      ascent += diff;
      reference = ele;
    } else if (diff <= -ASCENT_THRESHOLD_M) {
      descent -= diff;
      reference = ele;
    }
  }

  const times = points.map((p) => p[3]).filter((t): t is number => t !== null);
  const first = times.length ? Math.min(...times) : null;
  const last = times.length ? Math.max(...times) : null;
  return {
    distanceM: Math.round(distance),
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    maxElevationM: maxElevation === null ? null : Math.round(maxElevation),
    startedAt: first === null ? null : new Date(first).toISOString(),
    durationS: first !== null && last !== null && last > first ? Math.round((last - first) / 1000) : null,
  };
}

/**
 * The track as others may see it: the first and last `meters` along the
 * way removed, so a shared tour doesn't reveal where someone lives or
 * parks. Returns [] when the track is too short to show anything.
 */
export function trimEnds(points: TrackPoint[], meters: number): TrackPoint[] {
  if (meters <= 0) return points;
  const along: number[] = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceM(points[i - 1], points[i]));
  const total = along[along.length - 1];
  if (total <= 2 * meters) return [];
  return points.filter((_, i) => along[i] >= meters && along[i] <= total - meters);
}

export function bounds(points: TrackPoint[]): Bounds {
  return {
    minLat: Math.min(...points.map((p) => p[0])),
    minLon: Math.min(...points.map((p) => p[1])),
    maxLat: Math.max(...points.map((p) => p[0])),
    maxLon: Math.max(...points.map((p) => p[1])),
  };
}
