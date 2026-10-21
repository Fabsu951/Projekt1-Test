import type { AvalancheForecast, DangerLevel, Elevation, ForecastNote, ForecastProblem, ForecastTrend } from "../types/avalanche";
import { REGIONS } from "../data/regions";
import { PROBLEM_LABELS, SITE_PROBLEM_TYPES } from "../data/avalancheProblems";
import { COMPASS_SECTORS, type CompassSector } from "../utils/windAnalysis";
import { cached, withCache } from "./cache";
import { ApiError } from "./api";
import { isEnglish, t } from "../i18n";
import { timedFetch } from "../utils/timedFetch";

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
  /** "spring" (Vårförhållanden) or "no-danger" (Ingen lavinfara); older workers leave it out. */
  special?: "spring" | "no-danger" | null;
  trend?: unknown;
  snow?: unknown;
  weather?: unknown;
  problems?: WorkerProblem[];
}

const ELEVATIONS: Elevation[] = ["kalfjall", "tradgrans", "under_tradgrans"];
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const metres = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The forecast's own (Swedish) problem name, or the English one for a type we know. */
function problemName(siteType: unknown, name: string): string {
  const ours = typeof siteType === "string" ? SITE_PROBLEM_TYPES[siteType] : undefined;
  return isEnglish() && ours ? PROBLEM_LABELS[ours].label : name;
}

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
        name: problemName(p.type, name),
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

const httpLink = (v: unknown): string | null => (typeof v === "string" && /^https?:\/\//.test(v) ? v : null);

/** The expected development, only with a level 1–5 or a label, never a guess. */
export function toTrend(raw: unknown): ForecastTrend | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
  if (!date) return null;
  const level = r.danger;
  const dangerLevel = Number.isInteger(level) && (level as number) >= 1 && (level as number) <= 5 ? (level as DangerLevel) : null;
  const label = text(r.label);
  const note = text(r.text);
  if (dangerLevel === null && !label && !note) return null;
  return { date, dangerLevel, label, text: note };
}

export function toNote(raw: unknown): ForecastNote | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const body = typeof r.text === "string" && r.text.trim() ? r.text.trim() : null;
  if (!body) return null;
  return { title: text(r.title), text: body, link: httpLink(r.link), linkText: text(r.linkText) };
}

/** Trend, snow report and weather, which come with any forecast in force. */
function extras(item: WorkerRegionForecast) {
  return { trend: toTrend(item.trend), snow: toNote(item.snow), weather: toNote(item.weather) };
}

export function toForecast(item: WorkerRegionForecast): AvalancheForecast {
  const base = unavailable(item.regionId, item.sourceUrl || OFFICIAL_FORECAST_URL);
  if (item.fetchError) return base;
  if (item.seasonOver) return { ...base, status: "season-over" };
  if (item.notAssessed) return { ...base, status: "not-assessed" };
  if (item.special === "spring" || item.special === "no-danger") {
    return {
      ...base,
      status: item.special,
      headline: item.headline,
      mainMessage: text(item.mainMessage),
      publishedText: item.publishedText,
      problems: toProblems(item.problems),
      ...extras(item),
    };
  }
  if (item.danger !== null && Number.isInteger(item.danger) && item.danger >= 1 && item.danger <= 5) {
    return {
      ...base,
      status: "published",
      dangerLevel: item.danger as DangerLevel,
      headline: item.headline,
      mainMessage: text(item.mainMessage),
      publishedText: item.publishedText,
      problems: toProblems(item.problems),
      ...extras(item),
    };
  }
  return base;
}

export async function fetchAllForecasts(workerBase = WORKER_BASE): Promise<AvalancheForecast[]> {
  if (!workerBase) return REGIONS.map((r) => unavailable(r.id));

  const res = await timedFetch(`${workerBase.replace(/\/$/, "")}/forecasts`);
  if (!res.ok) throw new Error(t("Prognoshämtning misslyckades: {status}", { status: res.status }));
  const data: { regions: WorkerRegionForecast[] } = await res.json();

  const byId = new Map(data.regions.map((item) => [item.regionId, toForecast(item)]));
  return REGIONS.map((r) => byId.get(r.id) ?? unavailable(r.id));
}

/** One day in a region's recent danger levels. */
export interface HistoryDay {
  /** YYYY-MM-DD, Swedish time. */
  date: string;
  /** Null when no published forecast was recorded that day. */
  dangerLevel: DangerLevel | null;
}

/** Keeps well-formed days only; anything but a level 1–5 counts as "no forecast". */
export function toHistory(raw: unknown): HistoryDay[] {
  const days = (raw as { days?: unknown })?.days;
  if (!Array.isArray(days)) return [];
  return days.flatMap((d): HistoryDay[] => {
    if (typeof d?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return [];
    const level = d.danger;
    const valid = Number.isInteger(level) && level >= 1 && level <= 5;
    return [{ date: d.date, dangerLevel: valid ? (level as DangerLevel) : null }];
  });
}

/** The last week's recorded danger levels for a region, oldest first. */
export async function fetchForecastHistory(regionId: string, workerBase = WORKER_BASE): Promise<HistoryDay[]> {
  if (!workerBase) return [];
  const res = await timedFetch(`${workerBase.replace(/\/$/, "")}/forecasts/history?region=${encodeURIComponent(regionId)}&days=7`);
  if (!res.ok) throw new Error(t("Historikhämtning misslyckades: {status}", { status: res.status }));
  return toHistory(await res.json());
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

/** One day of a season, as the worker's /forecasts/season sends it. */
export interface SeasonDay {
  date: string;
  dangerLevel: DangerLevel | null;
  /** The forecast's wording when there's no level ("Ej bedömd lavinfara", "Vårförhållanden"). */
  label: string | null;
  problems: string[];
}

export interface Season {
  regionId: string;
  /** The year the season starts, e.g. 2025 for 2025/26. */
  season: number;
  days: SeasonDay[];
  levels: Record<DangerLevel, number>;
  problems: Array<{ type: string; name: string; days: number }>;
}

/** Keeps only well-formed data, and levels only 1–5. */
export function toSeason(raw: unknown): Season | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.regionId !== "string" || !Number.isInteger(r.season) || !Array.isArray(r.days)) return null;
  const days = r.days.flatMap((d): SeasonDay[] => {
    if (typeof d?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return [];
    const level = d.danger;
    const dangerLevel = Number.isInteger(level) && level >= 1 && level <= 5 ? (level as DangerLevel) : null;
    const problems = Array.isArray(d.problems) ? d.problems.filter((p: unknown): p is string => typeof p === "string") : [];
    return [{ date: d.date, dangerLevel, label: dangerLevel === null ? text(d.label) : null, problems }];
  });
  const levels = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DangerLevel, number>;
  for (const d of days) if (d.dangerLevel) levels[d.dangerLevel]++;
  const problems = Array.isArray(r.problems)
    ? r.problems.flatMap((p): Season["problems"] =>
        typeof p?.type === "string" && typeof p?.name === "string" && Number.isInteger(p?.days)
          ? [{ type: p.type, name: problemName(p.type, p.name), days: p.days }]
          : []
      )
    : [];
  return { regionId: r.regionId, season: r.season as number, days, levels, problems };
}

/** A whole season for an area, from Naturvårdsverket's API via the worker (saved for offline use). */
export async function fetchSeason(regionId: string, season: number, workerBase = WORKER_BASE): Promise<Season> {
  if (!workerBase) throw new Error(t("Säsongsdata saknas i den här versionen."));
  return cached(`season:${regionId}:${season}`, async () => {
    const res = await timedFetch(
      `${workerBase.replace(/\/$/, "")}/forecasts/season?region=${encodeURIComponent(regionId)}&season=${season}&v=2`
    );
    if (!res.ok) throw new ApiError(res.status, t("Kunde inte hämta säsongen just nu."));
    const season_ = toSeason(await res.json());
    if (!season_) throw new ApiError(502, t("Säsongsdatan gick inte att läsa."));
    return season_;
  });
}

/** The season that is on, or just ended (before November): 2025 for 2025/26. */
export function currentSeason(now = new Date()): number {
  const [y, m] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(now).split("-").map(Number);
  return m >= 11 ? y : y - 1;
}
