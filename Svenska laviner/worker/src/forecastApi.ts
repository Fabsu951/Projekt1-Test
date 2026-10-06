import { htmlToText, SITE_ORIGIN, stockholmDate, stockholmLocal, type Aspect, type Elevation, type ParsedProblem } from "./model";
import type { ParsedForecast } from "./parse";
import type { HistoryRow } from "./history";

// Naturvårdsverket's open avalanche-forecast API (GeoServer WFS), documented
// in "Lavinprognoser – en guide till öppna API:er" (2026). Built and tested
// against real answers in src/fixtures/nvgis (fetched with
// scripts/fetch-api-fixtures.ps1): for 17 forecasts that exist both there
// and in the archived pages, the level, aspects, heights and headline are
// identical. The same safety rules as for the pages apply: a level is only
// shown for a daily forecast that is in force right now.

export const API_BASE = "https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/ows";

/** The API's area ids for our six forecast regions (from the `location` layer). */
export const API_AREA_IDS: Record<string, number> = {
  "vastra-vindelfjallen": 1,
  riksgransfjallen: 2,
  "sodra-jamtlandsfjallen": 3,
  "vastra-harjedalsfjallen": 7,
  kebnekaisefjallen: 8,
  "sodra-lapplandsfjallen": 9,
};

/** A daily forecast is valid 10–24 h; anything much longer is not a daily forecast. */
const MAX_VALIDITY_MS = 48 * 60 * 60 * 1000;
/** How far back to ask, so a forecast published yesterday evening is included. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

/** The fields we read; leaving out the area polygon keeps answers small. */
const PROPERTIES = [
  "id",
  "published_date",
  "change_date",
  "valid_from",
  "valid_to",
  "area_id",
  "risk",
  "risk_rubrik",
  "assessment_title",
  "assessment_content",
  "problems",
  "updated_forecast_id",
];

export interface ApiForecast {
  id: number;
  publishedAt: Date | null;
  changedAt: Date | null;
  validFrom: Date | null;
  validTo: Date | null;
  /** 0 ej bedömd, 1–5 danger level, 6 vårförhållanden, 7 ingen lavinfara. */
  risk: number | null;
  riskLabel: string | null;
  headline: string | null;
  mainMessage: string | null;
  problems: ParsedProblem[];
  /** Set when a newer version of this forecast replaced it. */
  replacedBy: number | null;
}

/** "Spring conditions" and "no avalanche danger" are real answers, but not levels 1–5. */
export type SpecialRisk = "spring" | "no-danger";

export interface ApiParsedForecast extends ParsedForecast {
  special: SpecialRisk | null;
  /** The forecast's own wording for `special`, e.g. "Vårförhållanden". */
  riskLabel: string | null;
}

function viewparams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** "2026-02-18 07:00" in Swedish time, as the API's view parameters take it. */
function localStamp(at: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function layerUrl(layer: string, params: Record<string, string>, withPropertyNames = true): string {
  const url = new URL(API_BASE);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "1.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeName", `lavinprognoser:${layer}`);
  url.searchParams.set("outputformat", "application/json");
  if (withPropertyNames) url.searchParams.set("propertyName", PROPERTIES.join(","));
  url.searchParams.set("viewparams", viewparams(params));
  return url.toString();
}

/** Forecasts for an area from a few days back until now. */
export function recentUrl(areaId: number, now: Date, withPropertyNames = true): string {
  return layerUrl(
    "published_forecasts_by_interval",
    { lang: "sv", location: String(areaId), start_date: localStamp(new Date(now.getTime() - LOOKBACK_MS)) },
    withPropertyNames
  );
}

/** The forecast record covering now (also off-season, when it says the season is over). */
export function currentUrl(areaId: number, withPropertyNames = true): string {
  return layerUrl("published_forecasts", { lang: "sv", location: String(areaId) }, withPropertyNames);
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The interval layer gives ISO times ("2026-02-18T17:00:00Z"); the single
 * forecast layer gives Swedish wall-clock times ("2026-02-18 18:00").
 */
export function apiTime(value: unknown): Date | null {
  const text = str(value);
  if (!text) return null;
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) {
    const t = Date.parse(text);
    return Number.isNaN(t) ? null : new Date(t);
  }
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return stockholmLocal(Number(y), Number(mo), Number(d), Number(h ?? 0), Number(mi ?? 0));
}

/** The API's problem titles → lavinprognoser.se's slugs (what the app maps to its own types). */
const PROBLEM_SLUGS: Record<string, string> = {
  nysnöflak: "nysnoflak",
  drevsnöflak: "drevsnoflak",
  "bestående flak": "bestaende-flak",
  "våta laviner": "vata-laviner",
  glidlaviner: "glidlaviner",
  hängdrivor: "hangdrivor",
};

const DIRECTIONS: Array<[string, Aspect]> = [
  ["north", "N"],
  ["north_east", "NO"],
  ["east", "O"],
  ["south_east", "SO"],
  ["south", "S"],
  ["south_west", "SV"],
  ["west", "V"],
  ["north_west", "NV"],
];

const ALTITUDES: Array<[string, Elevation]> = [
  ["altitude_meter_above_treeline", "kalfjall"],
  ["altitude_meter_treeline", "tradgrans"],
  ["altitude_meter_below_treeline", "under_tradgrans"],
];

/**
 * The API gives avalanche size as a slider position. These three values are
 * the only ones seen in the 2025/26 season, each matched against the size
 * text on the same day's page. Other values show no size rather than a guess.
 */
const SIZE_TEXTS: Record<number, string> = {
  5: "Små laviner som i allmänhet är ofarliga men som på fel plats kan skada dig allvarligt (storlek 1).",
  40: "Laviner kan bli stora nog att begrava och döda dig (storlek 2).",
  85: "Laviner kan bli stora nog att bryta träd och ha kraft att förstöra en bil. Risken att du skadas eller dör om du dras med i en lavin av den storleken är mycket stor. (storlek 3).",
};

export function toProblem(raw: unknown): ParsedProblem | null {
  if (!isObj(raw)) return null;
  const name = str(raw.title);
  if (!name) return null;
  const type = PROBLEM_SLUGS[name.toLocaleLowerCase("sv-SE")];
  if (!type) return null;
  const size = num(raw.size_meter_value);
  return {
    type,
    name,
    aspects: DIRECTIONS.filter(([key]) => raw[`direction_meter_${key}`] === true).map(([, aspect]) => aspect),
    elevations: ALTITUDES.filter(([key]) => raw[key] === true).map(([, band]) => band),
    metersAbove: num(raw.above_meters),
    metersBelow: num(raw.below_meters),
    sensitivity: htmlToText(str(raw.sensitivity_spread_content)),
    size: size !== null ? (SIZE_TEXTS[size] ?? null) : null,
    where: htmlToText(str(raw.position_content)),
    infoUrl: `${SITE_ORIGIN}/sa-laser-du-lavinprognosen/lavinproblem/${type}/`,
  };
}

function problemsOf(value: unknown): ParsedProblem[] {
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list.map(toProblem).filter((p): p is ParsedProblem => p !== null) : [];
}

/** The forecasts in a GeoJSON answer; anything malformed is dropped. */
export function readForecasts(json: unknown): ApiForecast[] {
  if (!isObj(json) || !Array.isArray(json.features)) throw new Error("Oväntat svar från prognos-API:et.");
  return json.features.flatMap((f): ApiForecast[] => {
    const p = isObj(f) && isObj(f.properties) ? f.properties : null;
    const id = p ? num(p.id) : null;
    if (!p || id === null) return [];
    return [
      {
        id,
        publishedAt: apiTime(p.published_date),
        changedAt: apiTime(p.change_date),
        validFrom: apiTime(p.valid_from),
        validTo: apiTime(p.valid_to),
        risk: num(p.risk),
        riskLabel: str(p.risk_rubrik),
        headline: str(p.assessment_title),
        mainMessage: htmlToText(str(p.assessment_content)),
        problems: problemsOf(p.problems),
        replacedBy: num(p.updated_forecast_id),
      },
    ];
  });
}

/** A daily forecast: valid ≤ 48 h, published by now. Long records are season notes, not forecasts. */
function isDaily(f: ApiForecast, now: Date): boolean {
  return (
    f.validFrom !== null &&
    f.validTo !== null &&
    f.validTo.getTime() - f.validFrom.getTime() <= MAX_VALIDITY_MS &&
    (f.publishedAt === null || f.publishedAt.getTime() <= now.getTime())
  );
}

const covers = (f: ApiForecast, now: Date) =>
  f.validFrom !== null && f.validTo !== null && f.validFrom.getTime() <= now.getTime() && now.getTime() < f.validTo.getTime();

/** Newest version first: later change, then higher id. */
const newestFirst = (a: ApiForecast, b: ApiForecast) =>
  (b.changedAt?.getTime() ?? 0) - (a.changedAt?.getTime() ?? 0) || b.id - a.id;

/** The daily forecast in force right now (its latest correction), if any. */
export function forecastInForce(list: ApiForecast[], now: Date): ApiForecast | null {
  return list.filter((f) => isDaily(f, now) && covers(f, now)).sort(newestFirst)[0] ?? null;
}

/** "torsdag 19-02-2026 18:00", like the pages' "gäller från" text that the app shows. */
function validFromText(at: Date): string {
  const weekday = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", weekday: "long" }).format(at);
  const [date, time] = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(at)
    .split(" ");
  const [y, m, d] = date.split("-");
  return `${weekday} ${d}-${m}-${y} ${time}`;
}

function none(extra: Partial<ApiParsedForecast> = {}): ApiParsedForecast {
  return {
    assessed: false,
    danger: null,
    seasonOver: false,
    notAssessed: false,
    confidence: "explicit-none",
    headline: null,
    publishedText: null,
    mainMessage: null,
    problems: [],
    validUntil: null,
    special: null,
    riskLabel: null,
    ...extra,
  };
}

/**
 * What to show for an area now, from the area's recent forecasts plus the
 * record covering now (which off-season is a long "season is over" note).
 */
export function forecastFromApi(recent: ApiForecast[], current: ApiForecast[], now: Date): ApiParsedForecast {
  const f = forecastInForce([...recent, ...current], now);
  if (f) {
    if (f.risk === 0) return none({ assessed: true, notAssessed: true, headline: f.headline, mainMessage: f.mainMessage });
    if (f.risk === 6 || f.risk === 7) {
      return none({
        assessed: true,
        special: f.risk === 6 ? "spring" : "no-danger",
        riskLabel: f.riskLabel,
        headline: f.headline,
        mainMessage: f.mainMessage,
        publishedText: validFromText(f.validFrom!),
        problems: f.problems,
        validUntil: f.validTo!.toISOString(),
      });
    }
    if (f.risk !== null && Number.isInteger(f.risk) && f.risk >= 1 && f.risk <= 5) {
      return {
        assessed: true,
        danger: f.risk,
        seasonOver: false,
        notAssessed: false,
        confidence: "parsed",
        headline: f.headline,
        publishedText: validFromText(f.validFrom!),
        mainMessage: f.mainMessage,
        problems: f.problems,
        validUntil: f.validTo!.toISOString(),
        special: null,
        riskLabel: null,
      };
    }
    return { ...none(), confidence: "none" };
  }
  // No daily forecast now: a long record with risk 0 is the off-season note
  // ("Prognossäsongen är avslutad", "Försäsongstips").
  const note = current.filter((c) => covers(c, now) && !isDaily(c, now)).sort(newestFirst)[0];
  if (note && note.risk === 0) return none({ seasonOver: true, headline: note.headline });
  return { ...none(), confidence: "none" };
}

/** One history row per day (the day each forecast is valid until), from the latest version of each. */
export function historyRowsFromApi(regionId: string, list: ApiForecast[], now: Date): HistoryRow[] {
  const byDay = new Map<string, ApiForecast>();
  for (const f of [...list].filter((x) => isDaily(x, now)).sort(newestFirst)) {
    const day = stockholmDate(f.validTo!);
    if (!byDay.has(day)) byDay.set(day, f);
  }
  return [...byDay.entries()].flatMap(([date, f]) =>
    f.risk !== null && Number.isInteger(f.risk) && f.risk >= 1 && f.risk <= 5
      ? [{ regionId, date, danger: f.risk, problems: f.problems.map((p) => p.type) }]
      : []
  );
}
