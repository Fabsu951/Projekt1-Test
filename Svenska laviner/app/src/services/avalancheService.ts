import type { AvalancheForecast, DangerLevel, Elevation, ForecastProblem } from "../types/avalanche";
import { REGIONS } from "../data/regions";
import { SITE_PROBLEM_TYPES } from "../data/avalancheProblems";
import { COMPASS_SECTORS, type CompassSector } from "../utils/windAnalysis";
import { withCache } from "./cache";

/**
 * Official forecasts come from Naturvårdsverket's lavinprognoser.se
 * (published daily at 18:00, mid-December to mid-May), scraped by our
 * Cloudflare Worker's /forecasts route (see "Svenska laviner/worker"). The
 * worker is the same one that proxies map tiles, hence the shared env var.
 *
 * This app never shows a made-up danger level: anything we can't fetch or
 * parse confidently becomes status "unavailable" with a link to the
 * official page.
 */
const WORKER_BASE = import.meta.env.VITE_MAP_PROXY_URL as string | undefined;

export const OFFICIAL_FORECAST_URL = "https://www.lavinprognoser.se/";

/** One avalanche problem as the worker sends it (see worker/src/model.ts). */
export interface WorkerProblem {
  type: string;
  name: string;
  aspects: string[];
  elevations: string[];
  metersAbove: number | null;
  metersBelow: number | null;
  sensitivity: string | null;
  size: string | null;
  where: string | null;
  infoUrl: string | null;
}

/** Shape of one entry in the worker's `{ regions: [...] }` response. */
export interface WorkerRegionForecast {
  regionId: string;
  sourceUrl: string;
  fetchError: string | null;
  danger: number | null;
  seasonOver: boolean;
  notAssessed: boolean;
  headline: string | null;
  publishedText: string | null;
  /** Missing from workers deployed before problems were parsed. */
  mainMessage?: string | null;
  problems?: WorkerProblem[];
}

const ELEVATIONS: Elevation[] = ["kalfjall", "tradgrans", "under_tradgrans"];
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const metres = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Keeps only well-formed problems, and only the aspects/elevations we know how to draw. */
export function toProblems(raw: unknown): ForecastProblem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): ForecastProblem[] => {
    const name = text(p?.name);
    if (!name) return [];
    const list = (v: unknown) => (Array.isArray(v) ? v : []);
    return [
      {
        type: SITE_PROBLEM_TYPES[p.type] ?? null,
        name,
        aspects: COMPASS_SECTORS.filter((s: CompassSector) => list(p.aspects).includes(s)),
        elevations: ELEVATIONS.filter((e) => list(p.elevations).includes(e)),
        metersAbove: metres(p.metersAbove),
        metersBelow: metres(p.metersBelow),
        sensitivity: text(p.sensitivity),
        size: text(p.size),
        where: text(p.where),
        infoUrl: typeof p.infoUrl === "string" && p.infoUrl.startsWith("https://") ? p.infoUrl : null,
      },
    ];
  });
}

function unavailable(regionId: string, sourceUrl = OFFICIAL_FORECAST_URL): AvalancheForecast {
  return {
    regionId,
    status: "unavailable",
    dangerLevel: null,
    problems: [],
    headline: null,
    mainMessage: null,
    publishedText: null,
    sourceUrl,
  };
}

export function toForecast(item: WorkerRegionForecast): AvalancheForecast {
  const base = unavailable(item.regionId, item.sourceUrl || OFFICIAL_FORECAST_URL);
  if (item.fetchError) return base;
  if (item.seasonOver) return { ...base, status: "season-over" };
  if (item.notAssessed) return { ...base, status: "not-assessed" };
  if (item.danger !== null && Number.isInteger(item.danger) && item.danger >= 1 && item.danger <= 5) {
    return {
      ...base,
      status: "published",
      dangerLevel: item.danger as DangerLevel,
      headline: item.headline,
      mainMessage: text(item.mainMessage),
      publishedText: item.publishedText,
      problems: toProblems(item.problems),
    };
  }
  return base;
}

export async function fetchAllForecasts(workerBase = WORKER_BASE): Promise<AvalancheForecast[]> {
  if (!workerBase) return REGIONS.map((r) => unavailable(r.id));

  const res = await fetch(`${workerBase.replace(/\/$/, "")}/forecasts`);
  if (!res.ok) throw new Error(`Prognoshämtning misslyckades: ${res.status}`);
  const data: { regions: WorkerRegionForecast[] } = await res.json();

  const byId = new Map(data.regions.map((item) => [item.regionId, toForecast(item)]));
  return REGIONS.map((r) => byId.get(r.id) ?? unavailable(r.id));
}

export interface LoadedForecasts {
  byId: Record<string, AvalancheForecast>;
  /** True when the network failed and these came from the offline cache. */
  stale: boolean;
  cachedAt: string | null;
}

/**
 * Fetches all regions in one worker call, falling back to the last cached
 * copy offline, and to "unavailable" for every region if there is nothing
 * cached either — so callers never hang on a loading state.
 */
export async function loadForecasts(): Promise<LoadedForecasts> {
  let list: AvalancheForecast[];
  let stale = false;
  let cachedAt: string | null = null;
  try {
    const result = await withCache("forecasts:official", () => fetchAllForecasts());
    list = result.data;
    stale = result.stale;
    cachedAt = result.cachedAt;
  } catch {
    list = REGIONS.map((r) => unavailable(r.id));
  }
  const byId: Record<string, AvalancheForecast> = {};
  for (const f of list) byId[f.regionId] = f;
  return { byId, stale, cachedAt };
}
