import { extractModel, readForecast, stockholmDate, type ModelForecast, type ParsedProblem } from "./model";

export type { ParsedProblem } from "./model";

export interface ParsedForecast {
  assessed: boolean;
  danger: number | null;
  seasonOver: boolean;
  notAssessed: boolean;
  confidence: "parsed" | "explicit-none" | "none";
  headline: string | null;
  publishedText: string | null;
  /** The forecast's main message ("huvudbudskap") below the headline. */
  mainMessage: string | null;
  problems: ParsedProblem[];
  /** ISO time the published forecast is valid until; null without a level. */
  validUntil: string | null;
}

/** A daily forecast is valid 10–24 h; anything much longer is not a daily forecast. */
const MAX_VALIDITY_MS = 48 * 60 * 60 * 1000;

// "mycket stor" must come before "stor" in the alternation so level 5
// isn't also counted as level 4.
const DANGER_PHRASE = /(mycket\s+stor|stor|betydande|måttlig|liten)\s+lavinfara/gi;
const DANGER_PHRASE_LEVELS: Record<string, number> = {
  "mycket stor": 5,
  stor: 4,
  betydande: 3,
  måttlig: 2,
  liten: 1,
};
const SEASON_OVER = /prognossäsongen\s+är\s+avslutad|säsongen\s+är\s+slut/i;
const RISK_ALT = /alt="[^"]*[Rr]isk\s*([0-5])[^"]*"/g;

/**
 * Returns a level only when the page mentions exactly one distinct level.
 * A page that also carries a danger-scale legend (all five levels) is
 * ambiguous, and an ambiguous page must yield no level rather than
 * whichever one happens to match first.
 */
function singleLevel(levels: number[]): number | null {
  const distinct = new Set(levels.filter((l) => l >= 1 && l <= 5));
  return distinct.size === 1 ? [...distinct][0] : null;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&aring;/g, "å")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Aring;/g, "Å");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deliberately conservative: an unparseable page returns danger: null with
 * confidence "none" rather than guessing. A wrong danger level shown in an
 * avalanche safety app is worse than showing nothing and linking to the
 * official source. This mirrors the approach documented by the open-source
 * "toppturvarsel" scraper for the same site.
 */
function parseForecastText(rawHtml: string): ParsedForecast {
  const html = decodeEntities(rawHtml);
  const text = stripTags(html);

  const seasonOver = SEASON_OVER.test(text);
  // "Ej bedömd" also appears in the site's legend on every page (seen live
  // 2026-09: every region matched it), so it must not override a parsed
  // level — it only counts when no level was found.
  const notAssessedText = /ej\s+bedömd/i.test(text);

  if (seasonOver) {
    return {
      assessed: false,
      danger: null,
      seasonOver,
      notAssessed: notAssessedText,
      confidence: "explicit-none",
      headline: null,
      publishedText: null,
      mainMessage: null,
      problems: [],
      validUntil: null,
    };
  }

  let danger = singleLevel([...html.matchAll(RISK_ALT)].map((m) => Number(m[1])));

  if (danger === null) {
    danger = singleLevel(
      [...text.matchAll(DANGER_PHRASE)].map(
        (m) => DANGER_PHRASE_LEVELS[m[1].toLowerCase().replace(/\s+/g, " ")] ?? 0
      )
    );
  }

  if (danger === null && notAssessedText) {
    return {
      assessed: false,
      danger: null,
      seasonOver: false,
      notAssessed: true,
      confidence: "explicit-none",
      headline: null,
      publishedText: null,
      mainMessage: null,
      problems: [],
      validUntil: null,
    };
  }

  const headlineMatch = text.match(/Huvudbudskap[:\s]+([^.]{10,400}\.)/i);
  const publishedMatch = text.match(/Publicerad[:\s]+([^\n]{4,60})/i);

  return {
    assessed: danger !== null,
    danger,
    seasonOver: false,
    notAssessed: false,
    confidence: danger !== null ? "parsed" : "none",
    headline: headlineMatch ? headlineMatch[1].trim() : null,
    publishedText: publishedMatch ? publishedMatch[1].trim() : null,
    mainMessage: null,
    problems: [],
    validUntil: null,
  };
}

function noForecast(flags: { seasonOver?: boolean; notAssessed?: boolean } = {}): ParsedForecast {
  return {
    assessed: false,
    danger: null,
    seasonOver: flags.seasonOver ?? false,
    notAssessed: flags.notAssessed ?? false,
    confidence: "explicit-none",
    headline: null,
    publishedText: null,
    mainMessage: null,
    problems: [],
    validUntil: null,
  };
}

/**
 * A danger level is shown only for a forecast that is in force right now:
 * a validity window that contains `now`, is no longer than a daily forecast,
 * and wasn't published after today. Seen in the 2025/26 archive: a page
 * serving a "Måttlig" record valid for two months and published weeks
 * later — that must never reach a user as today's danger level.
 */
function fromModel(f: ModelForecast, now: Date): ParsedForecast {
  if (f.risk === null) return noForecast();

  const inForce =
    f.validFrom !== null &&
    f.validTo !== null &&
    f.validFrom.getTime() <= now.getTime() &&
    now.getTime() <= f.validTo.getTime();
  if (!inForce) return noForecast();

  if (f.risk === 0) return noForecast({ notAssessed: true });

  const plausible =
    f.risk >= 1 &&
    f.risk <= 5 &&
    Number.isInteger(f.risk) &&
    f.validTo!.getTime() - f.validFrom!.getTime() <= MAX_VALIDITY_MS &&
    (f.publishedDate === null || f.publishedDate <= stockholmDate(now));
  if (!plausible) return { ...noForecast(), confidence: "none" };

  return {
    assessed: true,
    danger: f.risk,
    seasonOver: false,
    notAssessed: false,
    confidence: "parsed",
    headline: f.headline,
    publishedText: f.validFromText,
    mainMessage: f.mainMessage,
    problems: f.problems,
    validUntil: f.validTo!.toISOString(),
  };
}

/**
 * Parses a lavinprognoser.se forecast page. Pages carry their data as a JSON
 * model (see model.ts), which is used whenever present; the text-matching
 * parser below is only a fallback in case the site stops embedding it.
 */
export function parseForecastHtml(rawHtml: string, now: Date = new Date()): ParsedForecast {
  const forecast = readForecast(extractModel(rawHtml));
  if (forecast) {
    const text = stripTags(decodeEntities(rawHtml));
    if (SEASON_OVER.test(text)) return noForecast({ seasonOver: true });
    return fromModel(forecast, now);
  }
  return parseForecastText(rawHtml);
}
