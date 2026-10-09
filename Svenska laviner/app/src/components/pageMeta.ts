import { getRegionById } from "../data/regions";
import { PUBLIC_SITE_URL } from "../services/native";

// What search engines see for each page: a description, the one address
// that counts (snolage.se, also when the page was opened on
// fjallkoll.pages.dev or www.), and "noindex" for pages that are personal,
// need an account, or show other people's tours and profiles.

const REGION_PAGE = /^\/omrade\/([^/]+)\/?$/;
const SEASON_PAGE = /^\/omrade\/([^/]+)\/sasong\/?$/;

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

/** snolage.se + the path, without query or trailing slash. */
export function canonicalUrl(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  return `${PUBLIC_SITE_URL}${path}`;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Updates the description, canonical address and robots hint in <head>. */
export function applyPageMeta(pathname: string, title: string): void {
  const description = pageDescription(pathname);
  const url = canonicalUrl(pathname);
  setMeta("name", "description", description);
  setMeta("name", "robots", isIndexable(pathname) ? "index, follow" : "noindex, follow");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}
