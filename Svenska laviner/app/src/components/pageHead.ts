import { getRegionById } from "../data/regions";

// Title, description and search-engine hints for a page address. Plain
// functions without browser or React imports, because they run in two
// places: in the app (Layout, through pageTitle.ts and pageMeta.ts) and at
// build time, when vite.config.ts writes a copy of index.html for each page
// in the sitemap with these already in <head> — link previews (Messenger,
// Slack, Facebook …) never run JavaScript.

const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, "Idag"],
  [/^\/omrade\/[^/]+\/sasong/, "Säsongen"],
  [/^\/omrade\//, "Område"],
  [/^\/karta/, "Karta"],
  [/^\/observationer\/ny/, "Ny observation"],
  [/^\/observationer/, "Observationer"],
  [/^\/turer\/ny/, "Ny tur"],
  [/^\/turer\/halsa/, "Hämta från klockan"],
  [/^\/turer\/\d/, "Tur"],
  [/^\/turer/, "Turer"],
  [/^\/flode/, "Flöde"],
  [/^\/notiser/, "Notiser"],
  [/^\/person\//, "Person"],
  [/^\/sakerhetsguide/, "Säkerhetsguide"],
  [/^\/om-appen/, "Om Snöläge"],
  [/^\/offline/, "Utan täckning"],
  [/^\/logga-in/, "Logga in"],
  [/^\/registrera/, "Skapa konto"],
  [/^\/profil/, "Min profil"],
  [/^\/admin/, "Anmälda inlägg"],
  [/^\/glomt-losenord/, "Glömt lösenord"],
  [/^\/aterstall-losenord/, "Nytt lösenord"],
  [/^\/verifiera/, "Bekräfta e-post"],
];

export function defaultTitle(pathname: string): string | null {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? null;
}

export function fullTitle(title: string | null): string {
  return title ? `${title} – Snöläge` : "Snöläge – lavinprognos och turer";
}

const REGION_PAGE = /^\/omrade\/([^/]+)\/?$/;
const SEASON_PAGE = /^\/omrade\/([^/]+)\/sasong\/?$/;

/** The tab title before the page itself has said anything (area pages by name). */
export function staticTitle(pathname: string): string {
  const season = SEASON_PAGE.exec(pathname);
  const seasonRegion = season && getRegionById(season[1]);
  if (seasonRegion) return fullTitle(`Säsongen – ${seasonRegion.name}`);
  const area = REGION_PAGE.exec(pathname);
  const region = area && getRegionById(area[1]);
  if (region) return fullTitle(region.name);
  return fullTitle(defaultTitle(pathname));
}

const DESCRIPTIONS: Array<[RegExp, string]> = [
  [
    /^\/$/,
    "Dagens lavinprognos för svenska fjällen på ett ställe: farograd, lavinproblem, fjällväder och vind för Kebnekaise, Riksgränsen, Vindelfjällen, Lapplandsfjällen, Jämtland och Härjedalen. Med karta, observationer och turer.",
  ],
  [
    /^\/karta\/?$/,
    "Karta över svenska fjällen med Lantmäteriets topografiska karta, Naturvårdsverkets lutningskartor, ruttplanering och observationer från skidåkare.",
  ],
  [
    /^\/observationer\/?$/,
    "Observationer från fjällen: laviner, skjutsprickor, wumpf, snödjup och förhållanden som skidåkare har rapporterat.",
  ],
  [
    /^\/turer\/?$/,
    "Skidturer i svenska fjällen som andra har delat, med höjdmeter, karta och en värmekarta över vanliga vägval.",
  ],
  [
    /^\/sakerhetsguide\/?$/,
    "Grunderna i lavinsäkerhet: hur laviner bildas, väder som ökar risken, branthet, terrängfällor, lavinproblemen och hur du läser lavinprognosen.",
  ],
  [/^\/om-appen\/?$/, "Om Snöläge: var uppgifterna kommer ifrån, användarvillkor och integritetspolicy."],
  [
    /^\/offline\/?$/,
    "Vad som fungerar utan mobiltäckning i fjällen, och hur du sparar kartor och rutter i förväg.",
  ],
];

const FALLBACK = DESCRIPTIONS[0][1];

/** The description for a page, or the site's own for pages without one. */
export function pageDescription(pathname: string): string {
  const season = SEASON_PAGE.exec(pathname);
  if (season) {
    const region = getRegionById(season[1]);
    if (region) {
      return `Säsongen dag för dag i ${region.name}: farograder och lavinproblem från Naturvårdsverkets lavinprognoser, som kalender och diagram.`;
    }
  }
  const area = REGION_PAGE.exec(pathname);
  if (area) {
    const region = getRegionById(area[1]);
    if (region) {
      return `Dagens lavinprognos för ${region.name}: farograd, lavinproblem, utveckling, fjällväder och vind, med länkar till Naturvårdsverket och SMHI.`;
    }
  }
  return DESCRIPTIONS.find(([re]) => re.test(pathname))?.[1] ?? FALLBACK;
}

/** Public pages worth showing in search results; everything else gets "noindex". */
export function isIndexable(pathname: string): boolean {
  if (DESCRIPTIONS.some(([re]) => re.test(pathname))) return true;
  const match = SEASON_PAGE.exec(pathname) ?? REGION_PAGE.exec(pathname);
  return !!match && !!getRegionById(match[1]);
}

/** The path without query or trailing slash ("/" stays "/"). */
export function canonicalPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
}

export interface PageHead {
  title: string;
  description: string;
  /** The canonical address, e.g. https://snolage.se/karta */
  url: string;
}

export function pageHead(pathname: string, siteUrl: string): PageHead {
  return {
    title: staticTitle(pathname),
    description: pageDescription(pathname),
    url: `${siteUrl.replace(/\/+$/, "")}${canonicalPath(pathname)}`,
  };
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * index.html with one page's title, description and address in <head>.
 * Throws if a tag it should fill is missing, so a changed index.html can't
 * quietly give every page the start page's text.
 */
export function withPageHead(html: string, head: PageHead): string {
  const title = escapeAttr(head.title);
  const description = escapeAttr(head.description);
  const url = escapeAttr(head.url);
  const attr = (tag: string, value: string): [RegExp, string] => [new RegExp(`(<${tag}=")[^"]*(")`), value];
  const swaps: Array<[RegExp, string]> = [
    attr('meta\\s+name="description"\\s+content', description),
    attr('link\\s+rel="canonical"\\s+href', url),
    attr('meta\\s+property="og:url"\\s+content', url),
    attr('meta\\s+property="og:title"\\s+content', title),
    attr('meta\\s+property="og:description"\\s+content', description),
  ];
  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
  if (!out.includes(`<title>${title}</title>`)) throw new Error("index.html saknar <title>");
  for (const [re, value] of swaps) {
    if (!re.test(out)) throw new Error(`index.html saknar ${re.source}`);
    out = out.replace(re, (_m, before: string, after: string) => `${before}${value}${after}`);
  }
  return out;
}
