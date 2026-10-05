import type { AvalancheForecast, Elevation, ForecastProblem } from "../types/avalanche";
import type { CompassSector } from "./windAnalysis";
import { COMPASS_SECTORS } from "./windAnalysis";
import { distanceM, type RouteSample } from "./routePlan";

// Compares a planned route with today's official forecast: which stretches
// of steep ground under the route face the aspects, and lie at the heights,
// where the forecast says an avalanche problem is found. It only ever points
// things out — no result here means "no match found", never "safe".

/** Ground at least this steep counts as avalanche terrain under the route. */
export const STEEP_DEG = 30;

/**
 * Rough height of the mountain birch treeline per forecast area, metres.
 * lavinprognoser.se gives problem heights as bands around the treeline, so
 * the comparison needs a number; these are deliberately round estimates
 * and shown to the user as such.
 */
export const TREELINE_M: Record<string, number> = {
  riksgransfjallen: 600,
  kebnekaisefjallen: 650,
  "vastra-vindelfjallen": 750,
  "sodra-lapplandsfjallen": 750,
  "sodra-jamtlandsfjallen": 850,
  "vastra-harjedalsfjallen": 900,
};

/** Half the height of the "trädgränsen" band around the treeline. */
const TREELINE_ZONE_M = 100;
/** Bands and metre limits are widened by this much, so edge cases are flagged rather than missed. */
const MARGIN_M = 50;
/** A route belongs to the nearest forecast area within this distance. */
const REGION_RADIUS_M = 80_000;

export function sectorOf(aspect: number): CompassSector {
  return COMPASS_SECTORS[Math.round((((aspect % 360) + 360) % 360) / 45) % 8];
}

/** The elevation bands a height may belong to (more than one near an edge). */
export function elevationBands(elevation: number, treeline: number): Elevation[] {
  const bands: Elevation[] = [];
  if (elevation >= treeline + TREELINE_ZONE_M - MARGIN_M) bands.push("kalfjall");
  if (Math.abs(elevation - treeline) <= TREELINE_ZONE_M + MARGIN_M) bands.push("tradgrans");
  if (elevation <= treeline - TREELINE_ZONE_M + MARGIN_M) bands.push("under_tradgrans");
  return bands;
}

/** Which of the problem's aspects and heights a sample of steep ground matches, or null. */
function matchSample(
  problem: ForecastProblem,
  sample: RouteSample,
  treeline: number
): { sector: CompassSector; bands: Elevation[] } | null {
  if (sample.slope === null || sample.slope < STEEP_DEG || sample.aspect === null || sample.elevation === null) return null;
  const sector = sectorOf(sample.aspect);
  // A problem listed without aspects is taken to apply to all of them.
  if (problem.aspects.length > 0 && !problem.aspects.includes(sector)) return null;

  if (problem.metersAbove !== null || problem.metersBelow !== null) {
    if (problem.metersAbove !== null && sample.elevation < problem.metersAbove - MARGIN_M) return null;
    if (problem.metersBelow !== null && sample.elevation > problem.metersBelow + MARGIN_M) return null;
    return { sector, bands: elevationBands(sample.elevation, treeline).filter((b) => problem.elevations.includes(b)) };
  }
  const bands = elevationBands(sample.elevation, treeline);
  if (problem.elevations.length === 0) return { sector, bands };
  const hit = bands.filter((b) => problem.elevations.includes(b));
  return hit.length ? { sector, bands: hit } : null;
}

export interface ProblemOnRoute {
  problem: ForecastProblem;
  /** Metres of steep route ground matching the problem's aspects and heights. */
  lengthM: number;
  sectors: CompassSector[];
  bands: Elevation[];
}

export interface RouteForecastCheck {
  regionId: string;
  treelineM: number;
  /** Metres of route over ground of STEEP_DEG or more. */
  steepM: number;
  problems: ProblemOnRoute[];
  /** Per sample: true where steep ground matches at least one problem. */
  flagged: boolean[];
}

/** The forecast area the route lies in: nearest to its middle, within 80 km. */
export function regionForRoute(
  samples: RouteSample[],
  regions: Array<{ id: string; lat: number; lon: number }>
): string | null {
  if (samples.length === 0) return null;
  const mid = samples[Math.floor(samples.length / 2)];
  let best: { id: string; d: number } | null = null;
  for (const r of regions) {
    const d = distanceM([mid.lat, mid.lon], [r.lat, r.lon]);
    if (!best || d < best.d) best = { id: r.id, d };
  }
  return best && best.d <= REGION_RADIUS_M ? best.id : null;
}

/** Only meaningful for a published forecast; callers handle the other statuses. */
export function checkRouteAgainstForecast(samples: RouteSample[], forecast: AvalancheForecast): RouteForecastCheck {
  const treelineM = TREELINE_M[forecast.regionId] ?? 750;
  const flagged = samples.map(() => false);
  let steepM = 0;
  const problems = forecast.problems.map((problem) => {
    let lengthM = 0;
    const sectors = new Set<CompassSector>();
    const bands = new Set<Elevation>();
    samples.forEach((s, i) => {
      if (i === 0) return;
      const match = matchSample(problem, s, treelineM);
      if (!match) return;
      lengthM += s.distM - samples[i - 1].distM;
      sectors.add(match.sector);
      match.bands.forEach((b) => bands.add(b));
      flagged[i] = true;
    });
    return {
      problem,
      lengthM,
      sectors: COMPASS_SECTORS.filter((c) => sectors.has(c)),
      bands: (["kalfjall", "tradgrans", "under_tradgrans"] as Elevation[]).filter((b) => bands.has(b)),
    };
  });
  samples.forEach((s, i) => {
    if (i > 0 && s.slope !== null && s.slope >= STEEP_DEG) steepM += s.distM - samples[i - 1].distM;
  });
  return { regionId: forecast.regionId, treelineM, steepM, problems, flagged };
}
