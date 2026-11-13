import { t } from "../i18n";

// Map search over the place names in data/ortnamn.json (OpenStreetMap):
// works offline, ignores case and accents (so "abiskojaure", "Ahkka" and
// "Áhkká" all match), prefers whole names and name starts, and among equal
// matches the one nearest the map – there are many lakes called Storsjön.

export type PlaceKind = "p" | "m" | "g" | "h" | "s" | "t" | "v" | "l" | "d" | "r" | "b";

/** As stored: [name, lat, lon, kind, ele (0 = unknown), other names?]. */
export type PlaceRow = [string, number, number, PlaceKind, number, string[]?];

export interface Place {
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  ele: number | null;
  /** The other name that matched, when it wasn't the main one. */
  alsoKnownAs: string | null;
}

export const KIND_LABELS: Record<PlaceKind, string> = {
  p: t("Topp"),
  m: t("Pass"),
  g: t("Glaciär"),
  h: t("Stuga"),
  s: t("Vindskydd"),
  t: t("Station"),
  v: t("Ort"),
  l: t("Sjö"),
  d: t("Dal"),
  r: t("Fjällkam"),
  b: t("Gränsröse"),
};

// Among equally good matches: places people head for before features.
const KIND_ORDER: PlaceKind[] = ["v", "p", "h", "s", "t", "b", "l", "g", "m", "d", "r"];

const SPECIAL: Record<string, string> = { ŋ: "n", đ: "d", ŧ: "t", ø: "o", æ: "ae", ß: "ss", ł: "l" };

/** Lower case, no accents or punctuation: "Áhkká – Akka" → "ahkka akka". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ŋđŧøæßł]/g, (c) => SPECIAL[c] ?? c)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface PlaceIndex {
  rows: PlaceRow[];
  /** Per row: folded main name first, then the other names. */
  keys: string[][];
}

export function buildIndex(rows: PlaceRow[]): PlaceIndex {
  return { rows, keys: rows.map((r) => [fold(r[0]), ...(r[5] ?? []).map(fold)]) };
}

/** 0 = the whole name, 1 = start of the name, 2 = start of a word, 3 = anywhere, null = no match. */
function matchScore(key: string, q: string): number | null {
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (key.includes(` ${q}`)) return 2;
  if (q.length >= 3 && key.includes(q)) return 3;
  return null;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** The best matches for what was typed (at least 2 letters), nearest the map centre first among equals. */
export function searchPlaces(index: PlaceIndex, query: string, near: { lat: number; lon: number } | null, limit = 12): Place[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const hits: Array<{ i: number; score: number; alt: number; dist: number }> = [];
  index.keys.forEach((keys, i) => {
    let best: number | null = null;
    let alt = 0;
    keys.forEach((key, k) => {
      const s = matchScore(key, q);
      if (s !== null && (best === null || s < best)) {
        best = s;
        alt = k;
      }
    });
    if (best === null) return;
    const row = index.rows[i];
    hits.push({ i, score: best, alt, dist: near ? distanceKm(near.lat, near.lon, row[1], row[2]) : 0 });
  });
  hits.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Far away matters more than kind: a lake nearby beats a village 800 km off.
    const da = Math.floor(a.dist / 50);
    const db = Math.floor(b.dist / 50);
    if (da !== db) return da - db;
    const ka = KIND_ORDER.indexOf(index.rows[a.i][3]);
    const kb = KIND_ORDER.indexOf(index.rows[b.i][3]);
    if (ka !== kb) return ka - kb;
    return a.dist - b.dist;
  });
  // OSM often has the same name twice close together (a massif as a range
  // and as a ridge, a lake as two parts): show it once.
  const out: Place[] = [];
  for (const { i, alt } of hits) {
    const [name, lat, lon, kind, ele, alts] = index.rows[i];
    const twin = out.some((p) => p.name === name && p.kind === kind && distanceKm(p.lat, p.lon, lat, lon) < DUPLICATE_KM);
    if (twin) continue;
    out.push({ name, lat, lon, kind, ele: ele > 0 ? ele : null, alsoKnownAs: alt > 0 ? (alts?.[alt - 1] ?? null) : null });
    if (out.length >= limit) break;
  }
  return out;
}

/** Same name and kind this close counts as one place. */
const DUPLICATE_KM = 10;
