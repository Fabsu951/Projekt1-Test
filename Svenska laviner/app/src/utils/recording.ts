import { distanceM, simplify, type TrackPoint } from "./trackImport";

// A tour recorded in the app ("Spela in tur"): the recorder (native or web,
// services/tourRecorder.ts) writes one line per entry, and everything here
// works on those lines, so the apps and the browser give the same numbers.
//   lat,lon,elevation or empty,time ms,accuracy m   a fix
//   P,time ms / R,time ms                            paused / resumed

export type RecordingEntry =
  | { kind: "fix"; lat: number; lon: number; ele: number | null; time: number; accuracy: number | null }
  | { kind: "pause"; time: number }
  | { kind: "resume"; time: number };

/** Fixes less precise than this are left out (a phone indoors or under a cliff). */
export const MAX_ACCURACY_M = 50;
/** Faster than this between two fixes is a GPS jump, not skiing. */
const MAX_SPEED_MS = 45;
/** Distance counts only once you have moved this far, so standing still doesn't add metres. */
const MIN_STEP_M = 8;
/** GPS heights wobble; a climb counts once it is this big. Only for the live figure. */
const ASCENT_HYSTERESIS_M = 10;

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function parseLine(line: string): RecordingEntry | null {
  const parts = line.trim().split(",");
  if (parts[0] === "P" || parts[0] === "R") {
    const time = num(parts[1]);
    if (time === null) return null;
    return { kind: parts[0] === "P" ? "pause" : "resume", time };
  }
  if (parts.length < 4) return null;
  const lat = num(parts[0]);
  const lon = num(parts[1]);
  const time = num(parts[3]);
  if (lat === null || lon === null || time === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { kind: "fix", lat, lon, ele: num(parts[2]), time, accuracy: num(parts[4]) };
}

export function fixLine(lat: number, lon: number, ele: number | null, time: number, accuracy: number | null): string {
  const ele1 = ele === null || !Number.isFinite(ele) ? "" : ele.toFixed(1);
  const acc = accuracy === null || !Number.isFinite(accuracy) ? "" : String(Math.round(accuracy));
  return `${lat.toFixed(6)},${lon.toFixed(6)},${ele1},${Math.round(time)},${acc}`;
}

export function parseLines(lines: string[]): RecordingEntry[] {
  return lines.map(parseLine).filter((e): e is RecordingEntry => e !== null);
}

type Fix = Extract<RecordingEntry, { kind: "fix" }>;

/**
 * The fixes worth keeping, in segments (a pause starts a new one): precise
 * enough, in time order, and no jumps faster than anyone skis.
 */
export function goodSegments(entries: RecordingEntry[]): Fix[][] {
  const segments: Fix[][] = [[]];
  let last: Fix | null = null;
  for (const e of entries) {
    if (e.kind === "pause") {
      if (segments[segments.length - 1].length) segments.push([]);
      continue;
    }
    if (e.kind !== "fix") continue;
    if (e.accuracy !== null && e.accuracy > MAX_ACCURACY_M) continue;
    if (last) {
      if (e.time <= last.time) continue;
      const speed = distanceM([last.lat, last.lon, null, null], [e.lat, e.lon, null, null]) / ((e.time - last.time) / 1000);
      if (speed > MAX_SPEED_MS) continue;
    }
    segments[segments.length - 1].push(e);
    last = e;
  }
  return segments.filter((s) => s.length > 0);
}

export interface RecordingSummary {
  distanceM: number;
  /** Rough: from the phone's GPS heights. The saved tour uses the height model instead. */
  ascentM: number;
  fixes: number;
  last: Fix | null;
}

export function summarize(entries: RecordingEntry[]): RecordingSummary {
  let distance = 0;
  let ascent = 0;
  let fixes = 0;
  let last: Fix | null = null;
  for (const segment of goodSegments(entries)) {
    let anchor = segment[0];
    let low: number | null = segment[0].ele;
    for (const fix of segment) {
      fixes++;
      last = fix;
      const step = distanceM([anchor.lat, anchor.lon, null, null], [fix.lat, fix.lon, null, null]);
      if (step >= MIN_STEP_M) {
        distance += step;
        anchor = fix;
      }
      if (fix.ele === null) continue;
      if (low === null || fix.ele < low) low = fix.ele;
      else if (fix.ele - low >= ASCENT_HYSTERESIS_M) {
        ascent += fix.ele - low;
        low = fix.ele;
      }
    }
  }
  return { distanceM: Math.round(distance), ascentM: Math.round(ascent), fixes, last };
}

/** Time spent recording (pauses left out), in ms. */
export function movingTimeMs(startedAt: number, pausedMs: number, until: number): number {
  return Math.max(0, until - startedAt - pausedMs);
}

/** The recording as a track ready to upload (same format and limits as an imported file). */
export function recordingToTrack(entries: RecordingEntry[]): TrackPoint[] {
  const points: TrackPoint[] = goodSegments(entries).flat().map((f) => [f.lat, f.lon, f.ele, f.time]);
  return simplify(points);
}

/** "1:05:09" or "12:09". */
export function clockText(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
