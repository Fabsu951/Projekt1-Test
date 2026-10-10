import { t } from "../i18n";
/**
 * Reads GPS tracks exported from watches and apps: GPX (Garmin, Suunto,
 * Coros, Strava, Apple via export apps …) and FIT (Garmin's own format).
 * Parsing happens in the app; the worker validates and computes the stats.
 */

/** [latitude, longitude, elevation in metres or null, time in ms or null] — same as the worker. */
export type TrackPoint = [number, number, number | null, number | null];

/** Points closer than this to the previous kept one add nothing on a map. */
const MIN_SPACING_M = 10;
export const MAX_UPLOAD_POINTS = 5000;

export function distanceM(a: TrackPoint, b: TrackPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLon = (b[1] - a[1]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const num = (value: string | null | undefined): number | null => {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function parseGpx(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error(t("Filen är ingen giltig GPX-fil."));
  const nodes = [...Array.from(doc.getElementsByTagName("trkpt")), ...Array.from(doc.getElementsByTagName("rtept"))];
  const points: TrackPoint[] = [];
  for (const node of nodes) {
    const lat = num(node.getAttribute("lat"));
    const lon = num(node.getAttribute("lon"));
    if (lat === null || lon === null) continue;
    const ele = num(node.getElementsByTagName("ele")[0]?.textContent);
    const timeText = node.getElementsByTagName("time")[0]?.textContent;
    const time = timeText ? Date.parse(timeText) : NaN;
    points.push([lat, lon, ele, Number.isFinite(time) ? time : null]);
  }
  return points;
}

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

export async function parseFit(data: ArrayBuffer): Promise<TrackPoint[]> {
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const decoder = new Decoder(Stream.fromArrayBuffer(data));
  if (!decoder.isFIT()) throw new Error(t("Filen är ingen giltig FIT-fil."));
  const { messages, errors } = decoder.read({ convertDateTimesToDates: true });
  if (errors.length && !messages.recordMesgs?.length) throw new Error(t("FIT-filen kunde inte läsas."));

  const points: TrackPoint[] = [];
  for (const r of (messages.recordMesgs ?? []) as Array<Record<string, unknown>>) {
    const lat = r.positionLat;
    const lon = r.positionLong;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const ele = typeof r.enhancedAltitude === "number" ? r.enhancedAltitude : typeof r.altitude === "number" ? r.altitude : null;
    const time = r.timestamp instanceof Date ? r.timestamp.getTime() : null;
    points.push([lat * SEMICIRCLES_TO_DEGREES, lon * SEMICIRCLES_TO_DEGREES, ele, time]);
  }
  return points;
}

/** Drops points that add nothing on a map, then thins evenly to fit the upload limit. */
export function simplify(points: TrackPoint[], max = MAX_UPLOAD_POINTS): TrackPoint[] {
  if (points.length <= 2) return points;
  const kept: TrackPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distanceM(kept[kept.length - 1], points[i]) >= MIN_SPACING_M) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  if (kept.length <= max) return kept;
  const step = (kept.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => kept[Math.round(i * step)]);
}

/** Reads a GPX or FIT file into points ready to upload. */
export async function importTrackFile(file: Blob & { name?: string }): Promise<TrackPoint[]> {
  const name = (file.name ?? "").toLowerCase();
  const bytes = await file.arrayBuffer();
  const header = new TextDecoder().decode(bytes.slice(8, 12));
  const points = name.endsWith(".fit") || header === ".FIT" ? await parseFit(bytes) : parseGpx(new TextDecoder().decode(bytes));
  if (points.length < 2) {
    throw new Error(t("Hittade inget GPS-spår i filen. Exportera turen som GPX eller FIT från klockan eller appen."));
  }
  return simplify(points);
}
