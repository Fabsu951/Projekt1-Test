export interface ParsedForecast {
  assessed: boolean;
  danger: number | null;
  seasonOver: boolean;
  notAssessed: boolean;
  confidence: "parsed" | "explicit-none" | "none";
  headline: string | null;
  publishedText: string | null;
}

const DANGER_WORDS: Array<{ pattern: RegExp; level: number }> = [
  { pattern: /mycket\s+stor\s+lavinfara/i, level: 5 },
  { pattern: /stor\s+lavinfara/i, level: 4 },
  { pattern: /betydande\s+lavinfara/i, level: 3 },
  { pattern: /måttlig\s+lavinfara/i, level: 2 },
  { pattern: /liten\s+lavinfara/i, level: 1 },
];

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
  const notAssessed = /ej\s+bedömd/i.test(text);

  if (seasonOver || notAssessed) {
    return {
      assessed: false,
      danger: null,
      seasonOver,
      notAssessed,
      confidence: "explicit-none",
      headline: null,
      publishedText: null,
    };
  }

  let danger: number | null = null;

  const altMatch = html.match(/alt="[^"]*[Rr]isk\s*([0-5])[^"]*"/);
  if (altMatch) {
    danger = Number(altMatch[1]);
  }

  if (danger === null) {
    for (const { pattern, level } of DANGER_WORDS) {
      if (pattern.test(text)) {
        danger = level;
        break;
      }
    }
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
