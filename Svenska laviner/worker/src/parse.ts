export interface ParsedForecast {
  assessed: boolean;
  danger: number | null;
  seasonOver: boolean;
  notAssessed: boolean;
  confidence: "parsed" | "explicit-none" | "none";
  headline: string | null;
  publishedText: string | null;
}

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
export function parseForecastHtml(rawHtml: string): ParsedForecast {
  const html = decodeEntities(rawHtml);
  const text = stripTags(html);

  const seasonOver =
    /prognossäsongen\s+är\s+avslutad/i.test(text) || /säsongen\s+är\s+slut/i.test(text);
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
  };
}
