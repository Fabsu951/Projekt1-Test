import type { ElevationSampler } from "./elevation";

// A planned ski tour: straight legs between the points the user clicks
// (there are no paths to follow in the mountains), sampled every few metres
// for height, the steepness of the ground underneath and which way it faces.

export type LatLon = [number, number];

/** Spacing of the samples along the route. */
const STEP_M = 25;
/** Height changes smaller than this are treated as noise when adding up climbing. */
const HYSTERESIS_M = 5;
const EARTH_RADIUS_M = 6371000;

/** Steepness bands, same colours as the map's slope layer. */
export const SLOPE_BANDS: Array<{ below: number; label: string; color: string }> = [
  { below: 30, label: "under 30°", color: "#325a82" },
  { below: 35, label: "30–35°", color: "#ffeb3b" },
  { below: 40, label: "35–40°", color: "#ff9800" },
  { below: 45, label: "40–45°", color: "#f44336" },
  { below: Infinity, label: "över 45°", color: "#8c145a" },
];

export function slopeBand(slope: number): number {
  return SLOPE_BANDS.findIndex((b) => slope < b.below);
}

export function distanceM(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RoutePoint {
  lat: number;
  lon: number;
  /** Distance from the start, metres. */
  distM: number;
}

/** Points every STEP_M along the straight legs between the waypoints, waypoints included. */
export function densify(waypoints: LatLon[]): RoutePoint[] {
  if (waypoints.length === 0) return [];
  const out: RoutePoint[] = [{ lat: waypoints[0][0], lon: waypoints[0][1], distM: 0 }];
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const leg = distanceM(a, b);
    const steps = Math.max(1, Math.ceil(leg / STEP_M));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({ lat: a[0] + (b[0] - a[0]) * t, lon: a[1] + (b[1] - a[1]) * t, distM: total + leg * t });
    }
    total += leg;
  }
  return out;
}

export interface RouteSample extends RoutePoint {
  elevation: number | null;
  /** Steepness of the ground under the route, degrees. */
  slope: number | null;
  /** Direction the ground faces, degrees from north; null on flat ground. */
  aspect: number | null;
}

export interface RouteAnalysis {
  samples: RouteSample[];
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxElevationM: number | null;
  /** Estimated moving time, hours (Munter method, no breaks). */
  hours: number;
  maxSlope: number | null;
  /** Metres of route in each slope band. */
  bandLengthsM: number[];
  /** True when some heights couldn't be loaded; numbers then cover only part of the route. */
  incomplete: boolean;
}

/**
 * Munter method, as used by Swiss guides: a leg costs one unit per km plus
 * one per 100 m climbed (uphill, 4 units/h on skins) or per 200 m descended
 * (downhill, 10 units/h on skis).
 */
export function munterHours(legs: Array<{ km: number; climbM: number }>): number {
  let hours = 0;
  for (const { km, climbM } of legs) {
    hours += climbM >= 0 ? (km + climbM / 100) / 4 : (km + -climbM / 200) / 10;
  }
  return hours;
}

export async function analyseRoute(waypoints: LatLon[], sampler: ElevationSampler): Promise<RouteAnalysis> {
  const points = densify(waypoints);
  await sampler.ready(points.map((p) => [p.lat, p.lon]));
  const samples: RouteSample[] = points.map((p) => {
    const t = sampler.terrainSync(p.lat, p.lon);
    return { ...p, elevation: t?.elevation ?? null, slope: t?.slope ?? null, aspect: t?.aspect ?? null };
  });

  let ascentM = 0;
  let descentM = 0;
  let anchor: number | null = null;
  let maxElevationM: number | null = null;
  let maxSlope: number | null = null;
  const bandLengthsM = SLOPE_BANDS.map(() => 0);
  const legs: Array<{ km: number; climbM: number }> = [];
  let incomplete = false;

  samples.forEach((s, i) => {
    if (s.elevation === null) {
      incomplete = true;
      return;
    }
    maxElevationM = maxElevationM === null ? s.elevation : Math.max(maxElevationM, s.elevation);
    if (anchor === null) anchor = s.elevation;
    else if (Math.abs(s.elevation - anchor) >= HYSTERESIS_M) {
      if (s.elevation > anchor) ascentM += s.elevation - anchor;
      else descentM += anchor - s.elevation;
      anchor = s.elevation;
    }
    const prev = samples[i - 1];
    if (prev && prev.elevation !== null) {
      const len = s.distM - prev.distM;
      legs.push({ km: len / 1000, climbM: s.elevation - prev.elevation });
      if (s.slope !== null) {
        bandLengthsM[slopeBand(s.slope)] += len;
        maxSlope = maxSlope === null ? s.slope : Math.max(maxSlope, s.slope);
      }
    }
  });

  return {
    samples,
    distanceM: points.length ? points[points.length - 1].distM : 0,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    maxElevationM: maxElevationM === null ? null : Math.round(maxElevationM),
    hours: munterHours(legs),
    maxSlope,
    bandLengthsM,
    incomplete,
  };
}

/** Consecutive samples in the same slope band, for drawing the route in colour. */
export function slopeRuns(samples: RouteSample[]): Array<{ band: number | null; positions: LatLon[] }> {
  const runs: Array<{ band: number | null; positions: LatLon[] }> = [];
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    const band = s.slope === null ? null : slopeBand(s.slope);
    const last = runs[runs.length - 1];
    const prev: LatLon = [samples[i - 1].lat, samples[i - 1].lon];
    if (last && last.band === band) last.positions.push([s.lat, s.lon]);
    else runs.push({ band, positions: [prev, [s.lat, s.lon]] });
  }
  return runs;
}

/** "2 h 15 min" / "45 min". */
export function formatHours(hours: number): string {
  const total = Math.max(1, Math.round((hours * 60) / 5) * 5);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The route as a GPX track with heights, for watches and other apps. */
export function routeToGpx(name: string, samples: RouteSample[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pts = samples
    .map(
      (s) =>
        `      <trkpt lat="${s.lat.toFixed(6)}" lon="${s.lon.toFixed(6)}">${
          s.elevation === null ? "" : `<ele>${s.elevation.toFixed(1)}</ele>`
        }</trkpt>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Snöläge" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
