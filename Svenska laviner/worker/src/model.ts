// lavinprognoser.se renders each forecast page from a JSON object embedded
// as `window.__model = {...}` (verified against 30 in-season pages from the
// 2025/26 season, see src/fixtures/lavinprognoser). Reading that object is
// far more reliable than matching visible text, and it carries the avalanche
// problems with their aspects and elevations.

export const SITE_ORIGIN = "https://www.lavinprognoser.se";

export type Aspect = "N" | "NO" | "O" | "SO" | "S" | "SV" | "V" | "NV";
export type Elevation = "kalfjall" | "tradgrans" | "under_tradgrans";

export interface ParsedProblem {
  /** The problem's slug on lavinprognoser.se, e.g. "drevsnoflak" or "bestaende-flak". */
  type: string;
  /** Display name as the forecast writes it, e.g. "Drevsnöflak". */
  name: string;
  /** Slope aspects where the problem is found. */
  aspects: Aspect[];
  /** Elevation bands where the problem is found. */
  elevations: Elevation[];
  /** Optional altitude limits in metres, when the forecaster gives them. */
  metersAbove: number | null;
  metersBelow: number | null;
  /** "Känslighet och utbredning", e.g. "Det är lätt att starta laviner på enstaka branta sluttningar." */
  sensitivity: string | null;
  /** "Förväntad största storlek på laviner", e.g. "... (storlek 2)." */
  size: string | null;
  /** "Här finns lavinproblemet". */
  where: string | null;
  /** The site's explanation page for this problem type. */
  infoUrl: string | null;
}

export interface ModelForecast {
  /** 0 = "Ej bedömd", 1–5 = danger level. Null when the page has no forecast. */
  risk: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  validFromText: string | null;
  publishedDate: string | null;
  headline: string | null;
  mainMessage: string | null;
  problems: ParsedProblem[];
}

const MODEL_MARKER = "window.__model";

/**
 * Returns the JSON object assigned to `window.__model`, or null when the
 * page doesn't have one (or it can't be parsed).
 */
export function extractModel(html: string): unknown {
  const marker = html.indexOf(MODEL_MARKER);
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  if (start < 0) return null;

  // Walk to the matching closing brace, skipping over string contents.
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  auml: "ä",
  ouml: "ö",
  aring: "å",
  Auml: "Ä",
  Ouml: "Ö",
  Aring: "Å",
};

/**
 * The forecast texts are pasted from Word, so they carry conditional
 * comments full of Office XML; drop those along with the markup.
 */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script|xml)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Offset of Europe/Stockholm from UTC, in minutes, at the given instant. */
function stockholmOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** YYYY-MM-DD of an instant in Swedish local time. */
export function stockholmDate(at: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(at);
}

/** An instant from a Swedish wall-clock time (handles summer/winter time). */
export function stockholmLocal(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = stockholmOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offset * 60000);
}

/** Parses the site's "fredag 20-02-2026 18:00" (Swedish local time). */
export function parseSwedishDateTime(text: string | null | undefined): Date | null {
  const m = text?.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m.map(Number);
  const naiveUtc = Date.UTC(yyyy, mm - 1, dd, hh, min);
  const offset = stockholmOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offset * 60000);
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const on = (v: unknown): boolean => isObj(v) && v.state === true;

const ASPECT_PANELS: Array<[string, Aspect]> = [
  ["northPanel", "N"],
  ["northEastPanel", "NO"],
  ["eastPanel", "O"],
  ["southEastPanel", "SO"],
  ["southPanel", "S"],
  ["southWestPanel", "SV"],
  ["westPanel", "V"],
  ["northWestPanel", "NV"],
];

const ELEVATION_METERS: Array<[string, Elevation]> = [
  ["altitudeMeterAboveTreeline", "kalfjall"],
  ["altitudeMeterTreeline", "tradgrans"],
  ["altitudeMeterBelowTreeline", "under_tradgrans"],
];

function parseProblem(raw: unknown): ParsedProblem | null {
  if (!isObj(raw)) return null;
  const description = isObj(raw.description) ? raw.description : {};
  const symbol = isObj(raw.symbol) && isObj(raw.symbol.image) ? raw.symbol.image : {};
  const infoPath = str(description.url);
  const type = infoPath?.match(/\/lavinproblem\/([a-z0-9-]+)\/?$/)?.[1] ?? null;
  const name = str(description.title) ?? str(symbol.alt);
  if (!type || !name) return null;

  const direction = isObj(raw.direction) ? raw.direction : {};
  const altitude = isObj(raw.altitude) ? raw.altitude : {};
  const information = Array.isArray(raw.information) ? raw.information.filter(isObj) : [];
  const info = (hrefPart: string) =>
    str(information.find((i) => String(i.href ?? "").includes(hrefPart))?.description);
  const position = isObj(raw.position) ? raw.position : {};

  return {
    type,
    name,
    aspects: ASPECT_PANELS.filter(([key]) => on(direction[key])).map(([, aspect]) => aspect),
    elevations: ELEVATION_METERS.filter(([key]) => on(altitude[key])).map(([, band]) => band),
    metersAbove: num(altitude.metersAbove),
    metersBelow: num(altitude.metersBelow),
    sensitivity: info("sensitivityanddistribution"),
    size: info("avalanchesize"),
    where: htmlToText(str(position.content)),
    infoUrl: infoPath ? `${SITE_ORIGIN}${infoPath}` : null,
  };
}

/**
 * Reads the forecast out of an extracted model. Returns undefined when the
 * model isn't a forecast page at all, and a forecast with risk null when the
 * page says there is no forecast ("Prognos saknas").
 */
export function readForecast(model: unknown): ModelForecast | undefined {
  if (!isObj(model) || !isObj(model.content) || !("forecast" in model.content)) return undefined;
  const f = model.content.forecast;
  if (!isObj(f)) {
    return {
      risk: null,
      validFrom: null,
      validTo: null,
      validFromText: null,
      publishedDate: null,
      headline: null,
      mainMessage: null,
      problems: [],
    };
  }

  const problemList = isObj(f.avalancheProblem) && Array.isArray(f.avalancheProblem.problems)
    ? f.avalancheProblem.problems
    : [];

  return {
    risk: num(f.risk),
    validFrom: parseSwedishDateTime(str(f.validFrom)),
    validTo: parseSwedishDateTime(str(f.validTo)),
    validFromText: str(f.validFrom),
    publishedDate: str(f.publishedDate),
    headline: str(f.assessmentHeading),
    mainMessage: htmlToText(str(f.assessmentContent)),
    problems: problemList.map(parseProblem).filter((p): p is ParsedProblem => p !== null),
  };
}
