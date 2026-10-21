import { REGION_SOURCES, type RegionSource } from "./regions";
import { stockholmDate } from "./model";
import type { Lang } from "./lang";

// SMHI's impact-based weather warnings (open data, no account):
// https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json
// A list of alerts, each with one or more warning areas: level (yellow,
// orange, red, or a "message"), the event (wind, snow, rain …), when, a
// description, the affected counties and the area's outline. An area
// counts as warned when the outline covers any of a few points in and
// around it; without an outline, when the warning names its county.
// Shape checked against open-source readers of the API (cloud sessions
// can't reach SMHI); everything is read defensively.

export const WARNINGS_URL = "https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json";
export const WARNINGS_PAGE = "https://www.smhi.se/vader/varningar-och-brandrisk/varningar-och-meddelanden/varningar";

export type WarningLevel = "yellow" | "orange" | "red" | "message";

export interface Warning {
  id: string;
  level: WarningLevel;
  event: { sv: string; en: string };
  area: { sv: string; en: string };
  start: string | null;
  end: string | null;
  text: { sv: string; en: string };
}

interface ParsedWarning extends Warning {
  /** Outer rings as [lon, lat] points. */
  rings: number[][][];
  /** Affected counties/areas by Swedish name. */
  counties: string[];
}

const COUNTY: Record<string, string> = {
  kebnekaisefjallen: "Norrbottens län",
  riksgransfjallen: "Norrbottens län",
  "vastra-vindelfjallen": "Västerbottens län",
  "sodra-lapplandsfjallen": "Västerbottens län",
  "sodra-jamtlandsfjallen": "Jämtlands län",
  "vastra-harjedalsfjallen": "Jämtlands län",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const pair = (v: unknown): { sv: string; en: string } => {
  const o = (v ?? {}) as Record<string, unknown>;
  const sv = str(o.sv);
  return { sv, en: str(o.en) || sv };
};
const time = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

function levelOf(v: unknown): WarningLevel | null {
  const code = str((v as { code?: unknown } | undefined)?.code).toUpperCase();
  if (code === "YELLOW") return "yellow";
  if (code === "ORANGE") return "orange";
  if (code === "RED") return "red";
  if (code === "MESSAGE") return "message";
  return null;
}

/** Every outer ring in a GeoJSON geometry, feature or collection. */
function ringsOf(g: unknown, out: number[][][] = []): number[][][] {
  const o = g as { type?: string; features?: unknown[]; geometry?: unknown; geometries?: unknown[]; coordinates?: unknown };
  if (!o || typeof o !== "object") return out;
  if (o.type === "FeatureCollection" && Array.isArray(o.features)) o.features.forEach((f) => ringsOf(f, out));
  else if (o.type === "Feature") ringsOf(o.geometry, out);
  else if (o.type === "GeometryCollection" && Array.isArray(o.geometries)) o.geometries.forEach((x) => ringsOf(x, out));
  else if (o.type === "Polygon" && Array.isArray(o.coordinates)) out.push(o.coordinates[0] as number[][]);
  else if (o.type === "MultiPolygon" && Array.isArray(o.coordinates))
    for (const poly of o.coordinates as number[][][][]) out.push(poly[0]);
  return out.filter((r) => Array.isArray(r) && r.length >= 3 && r.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])));
}

/** Warnings still in force (or coming) from SMHI's answer. */
export function parseWarnings(json: unknown, now = new Date()): ParsedWarning[] {
  if (!Array.isArray(json)) throw new Error("Oväntat svar från SMHI:s varningar.");
  const out: ParsedWarning[] = [];
  for (const alert of json as Array<Record<string, unknown>>) {
    const event = pair(alert?.event);
    for (const wa of Array.isArray(alert?.warningAreas) ? (alert.warningAreas as Array<Record<string, unknown>>) : []) {
      const level = levelOf(wa?.warningLevel);
      if (!level) continue;
      const end = time(wa.approximateEnd);
      if (end && Date.parse(end) < now.getTime()) continue;
      const affected = Array.isArray(wa.affectedAreas) ? (wa.affectedAreas as unknown[]).map(pair).filter((a) => a.sv) : [];
      const areaName = pair(wa.areaName);
      const descriptions = Array.isArray(wa.descriptions) ? (wa.descriptions as Array<Record<string, unknown>>) : [];
      const lines = (lang: "sv" | "en") =>
        descriptions
          .map((d) => {
            const title = pair(d?.title)[lang];
            const text = pair(d?.text)[lang];
            return text ? (title ? `${title}: ${text}` : text) : "";
          })
          .filter(Boolean)
          .join("\n");
      const eventDescription = pair(wa.eventDescription);
      out.push({
        id: `${str(String(alert?.id ?? ""))}-${str(String(wa.id ?? ""))}`,
        level,
        event: eventDescription.sv ? eventDescription : event,
        area: areaName.sv ? areaName : { sv: affected.map((a) => a.sv).join(", "), en: affected.map((a) => a.en).join(", ") },
        start: time(wa.approximateStart),
        end,
        text: { sv: lines("sv"), en: lines("en") || lines("sv") },
        rings: ringsOf(wa.area),
        counties: affected.map((a) => a.sv),
      });
    }
  }
  return out;
}

function inRing([x, y]: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The area's centre and points about 20 km around it, as [lon, lat]. */
function probePoints(r: RegionSource): Array<[number, number]> {
  const dLat = 0.18;
  const dLon = 0.4;
  return [
    [r.lon, r.lat],
    [r.lon, r.lat + dLat],
    [r.lon, r.lat - dLat],
    [r.lon + dLon, r.lat],
    [r.lon - dLon, r.lat],
  ];
}

export function warnsRegion(w: ParsedWarning, r: RegionSource): boolean {
  if (w.rings.length > 0) return probePoints(r).some((p) => w.rings.some((ring) => inRing(p, ring)));
  const county = COUNTY[r.id];
  return Boolean(county && w.counties.includes(county));
}

const strip = ({ rings: _r, counties: _c, ...w }: ParsedWarning): Warning => w;

/** Warnings per area id (areas without any are left out). */
export function warningsByRegion(warnings: ParsedWarning[]): Record<string, Warning[]> {
  const out: Record<string, Warning[]> = {};
  for (const r of REGION_SOURCES) {
    const list = warnings.filter((w) => warnsRegion(w, r)).map(strip);
    if (list.length) out[r.id] = list;
  }
  return out;
}

export async function fetchWarnings(fetcher: typeof fetch = fetch, now = new Date()): Promise<Record<string, Warning[]>> {
  const res = await fetcher(WARNINGS_URL, { headers: { "User-Agent": "Snolage/1.0 (https://snolage.se)" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`SMHI:s varningar svarade ${res.status}.`);
  return warningsByRegion(parseWarnings(await res.json(), now));
}

/** Whether a warning covers any part of a Swedish date (YYYY-MM-DD). */
export function coversDay(w: Warning, date: string): boolean {
  const startDay = w.start ? stockholmDate(new Date(w.start)) : "0000-00-00";
  const endDay = w.end ? stockholmDate(new Date(w.end)) : "9999-12-31";
  return startDay <= date && date <= endDay;
}

const LEVEL_NAMES: Record<Lang, Record<WarningLevel, string>> = {
  sv: { yellow: "Gul varning", orange: "Orange varning", red: "Röd varning", message: "Meddelande" },
  en: { yellow: "Yellow warning", orange: "Orange warning", red: "Red warning", message: "Message" },
};

/** " SMHI: Gul varning – Vind." for the warnings covering a tour day. */
export function warningSentence(list: Warning[], lang: Lang): string {
  if (list.length === 0) return "";
  const items = list.map((w) => `${LEVEL_NAMES[lang][w.level]} – ${w.event[lang] || w.event.sv}`).join("; ");
  return lang === "en" ? ` SMHI weather warning: ${items}.` : ` SMHI varnar: ${items}.`;
}
