import { currentUser, requirePoster, requireUser, type CommunityEnv, type User } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";
import { cleanPoints, distanceM, previewLine, trackStats, trimEnds, type TrackPoint } from "./track";

export const HIDE_ENDS_OPTIONS = [0, 200, 500, 1000] as const;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 4000;
/** A tour belongs to the nearest forecast region within this distance of its start. */
const REGION_RADIUS_M = 80_000;
const UPLOAD_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

interface TourRow {
  id: number;
  user_id: number;
  display_name: string;
  title: string;
  description: string;
  started_at: string;
  duration_s: number | null;
  distance_m: number;
  ascent_m: number;
  descent_m: number;
  max_elevation_m: number | null;
  region_id: string | null;
  shared: number;
  hide_ends_m: number;
  pin_lat: number | null;
  pin_lon: number | null;
  track_key: string;
  preview: string | null;
  created_at: string;
}

export interface Tour {
  id: number;
  userId: number;
  author: string;
  title: string;
  description: string;
  startedAt: string;
  durationS: number | null;
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxElevationM: number | null;
  regionId: string | null;
  shared: boolean;
  hideEndsM: number;
  /** Where to put the tour on a map (after the hidden start), or null if nothing is shown. */
  pin: [number, number] | null;
  createdAt: string;
}

function toTour(row: TourRow): Tour {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.display_name,
    title: row.title,
    description: row.description,
    startedAt: row.started_at,
    durationS: row.duration_s,
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    descentM: row.descent_m,
    maxElevationM: row.max_elevation_m,
    regionId: row.region_id,
    shared: row.shared === 1,
    hideEndsM: row.hide_ends_m,
    pin: row.pin_lat !== null && row.pin_lon !== null ? [row.pin_lat, row.pin_lon] : null,
    createdAt: row.created_at,
  };
}

const SELECT = "SELECT t.*, u.display_name FROM tours t JOIN users u ON u.id = t.user_id";

export function nearestRegion(point: TrackPoint): string | null {
  let best: { id: string; d: number } | null = null;
  for (const r of REGION_SOURCES) {
    const d = distanceM(point, [r.lat, r.lon, null, null]);
    if (!best || d < best.d) best = { id: r.id, d };
  }
  return best && best.d <= REGION_RADIUS_M ? best.id : null;
}

function hideEnds(value: unknown): number {
  const n = Number(value);
  return (HIDE_ENDS_OPTIONS as readonly number[]).includes(n) ? n : 500;
}

function text(value: unknown, max: number, field: string, required = false): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) throw new HttpError(400, `Ange ${field}.`);
  if (s.length > max) throw new HttpError(400, `${field[0].toUpperCase()}${field.slice(1)} får vara högst ${max} tecken.`);
  return s;
}

function publicPin(points: TrackPoint[], hide: number): [number, number] | null {
  const visible = trimEnds(points, hide);
  return visible.length ? [visible[0][0], visible[0][1]] : null;
}

interface CreateBody {
  title?: unknown;
  description?: unknown;
  shared?: unknown;
  hideEndsM?: unknown;
  /** Used when the track itself has no timestamps, as YYYY-MM-DD. */
  date?: unknown;
  points?: unknown;
}

export async function createTour(request: Request, env: CommunityEnv) {
  const user = await requirePoster(request, env);
  const store = d1Store(env.DB);
  const key = `tour-upload:${user.id}`;
  await enforce(store, [{ key, ...UPLOAD_LIMIT }], "Du har laddat upp många turer den senaste timmen. Försök igen senare.");

  const body = await readJson<CreateBody>(request);
  const title = text(body.title, MAX_TITLE, "en titel", true);
  const description = text(body.description, MAX_DESCRIPTION, "beskrivningen");
  let points: TrackPoint[];
  try {
    points = cleanPoints(body.points);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Ogiltigt spår.");
  }
  const stats = trackStats(points);
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? `${body.date}T12:00:00.000Z` : null;
  const startedAt = stats.startedAt ?? date;
  if (!startedAt) throw new HttpError(400, "Spåret saknar tider. Ange vilket datum turen gjordes.");
  if (new Date(startedAt).getTime() > Date.now() + 24 * 3600 * 1000) throw new HttpError(400, "Turen kan inte ligga i framtiden.");

  const shared = body.shared === undefined ? true : body.shared === true;
  const hide = hideEnds(body.hideEndsM);
  const pin = publicPin(points, hide);
  const preview = previewLine(points, hide);
  const trackKey = `tracks/${crypto.randomUUID()}.json`;
  await env.IMAGES.put(trackKey, JSON.stringify(points), { httpMetadata: { contentType: "application/json" } });

  const result = await env.DB.prepare(
    `INSERT INTO tours (user_id, title, description, started_at, duration_s, distance_m, ascent_m, descent_m,
       max_elevation_m, region_id, shared, hide_ends_m, pin_lat, pin_lon, track_key, preview, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user.id,
      title,
      description,
      startedAt,
      stats.durationS,
      stats.distanceM,
      stats.ascentM,
      stats.descentM,
      stats.maxElevationM,
      nearestRegion(points[0]),
      shared ? 1 : 0,
      hide,
      pin?.[0] ?? null,
      pin?.[1] ?? null,
      trackKey,
      preview ? JSON.stringify(preview) : null,
      nowIso()
    )
    .run();
  await record(store, [key]);
  const row = await env.DB.prepare(`${SELECT} WHERE t.id = ?`).bind(Number(result.meta.last_row_id)).first<TourRow>();
  return { tour: toTour(row!) };
}

/** Month numbers 1–12 from "12,1,2"; empty means all months. */
export function parseMonths(value: string | null): string[] {
  const months = (value ?? "")
    .split(",")
    .map(Number)
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return [...new Set(months)].map((m) => String(m).padStart(2, "0"));
}

/** Region and season filters shared by the list and the heatmap. */
function addFilters(url: URL, where: string[], binds: unknown[]) {
  const region = url.searchParams.get("region");
  if (region) {
    where.push("t.region_id = ?");
    binds.push(region);
  }
  const months = parseMonths(url.searchParams.get("months"));
  if (months.length) {
    where.push(`strftime('%m', t.started_at) IN (${months.map(() => "?").join(", ")})`);
    binds.push(...months);
  }
}

export async function listTours(request: Request, env: CommunityEnv) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const where: string[] = [];
  const binds: unknown[] = [];

  if (url.searchParams.get("mine") === "1") {
    const user = await requireUser(request, env);
    where.push("t.user_id = ?");
    binds.push(user.id);
  } else {
    where.push("t.shared = 1");
  }
  addFilters(url, where, binds);

  const rows = await env.DB.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY t.started_at DESC LIMIT ?`)
    .bind(...binds, limit)
    .all<TourRow>();
  return { tours: rows.results.map(toTour) };
}

/** Most tours drawn on the heatmap at once (newest first). */
const HEATMAP_LIMIT = 500;

/** Public lines of shared tours for the heatmap, never the hidden ends. */
export async function tourLines(request: Request, env: CommunityEnv) {
  const url = new URL(request.url);
  const where = ["t.shared = 1", "t.preview IS NOT NULL"];
  const binds: unknown[] = [];
  addFilters(url, where, binds);
  const rows = await env.DB.prepare(
    `SELECT t.id, t.preview FROM tours t WHERE ${where.join(" AND ")} ORDER BY t.started_at DESC LIMIT ?`
  )
    .bind(...binds, HEATMAP_LIMIT)
    .all<{ id: number; preview: string }>();
  return { lines: rows.results.map((r) => ({ id: r.id, points: JSON.parse(r.preview) as Array<[number, number]> })) };
}

async function getRow(env: CommunityEnv, id: number): Promise<TourRow> {
  const row = await env.DB.prepare(`${SELECT} WHERE t.id = ?`).bind(id).first<TourRow>();
  if (!row) throw new HttpError(404, "Turen finns inte.");
  return row;
}

const canModify = (user: User, row: TourRow) => user.isAdmin || user.id === row.user_id;

/** The tour and its track: whole for the owner, with hidden ends for everyone else. */
export async function getTour(request: Request, env: CommunityEnv, id: number) {
  const row = await getRow(env, id);
  const viewer = await currentUser(request, env);
  const isOwner = viewer?.id === row.user_id;
  if (!row.shared && !isOwner) throw new HttpError(404, "Turen finns inte.");

  const object = await env.IMAGES.get(row.track_key);
  const points = object ? ((await object.json()) as TrackPoint[]) : [];
  return { tour: toTour(row), track: isOwner ? points : trimEnds(points, row.hide_ends_m) };
}

export async function updateTour(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (user.id !== row.user_id) throw new HttpError(403, "Du kan bara ändra dina egna turer.");
  const body = await readJson<CreateBody>(request);

  const title = body.title === undefined ? row.title : text(body.title, MAX_TITLE, "en titel", true);
  const description = body.description === undefined ? row.description : text(body.description, MAX_DESCRIPTION, "beskrivningen");
  const shared = body.shared === undefined ? row.shared === 1 : body.shared === true;
  const hide = body.hideEndsM === undefined ? row.hide_ends_m : hideEnds(body.hideEndsM);

  let pin: [number, number] | null = row.pin_lat !== null && row.pin_lon !== null ? [row.pin_lat, row.pin_lon] : null;
  let preview = row.preview;
  if (hide !== row.hide_ends_m) {
    const object = await env.IMAGES.get(row.track_key);
    const points = object ? ((await object.json()) as TrackPoint[]) : [];
    pin = publicPin(points, hide);
    const line = previewLine(points, hide);
    preview = line ? JSON.stringify(line) : null;
  }
  await env.DB.prepare(
    "UPDATE tours SET title = ?, description = ?, shared = ?, hide_ends_m = ?, pin_lat = ?, pin_lon = ?, preview = ? WHERE id = ?"
  )
    .bind(title, description, shared ? 1 : 0, hide, pin?.[0] ?? null, pin?.[1] ?? null, preview, id)
    .run();
  return { tour: toTour(await getRow(env, id)) };
}

export async function deleteTour(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (!canModify(user, row)) throw new HttpError(403, "Du kan bara ta bort dina egna turer.");
  await env.IMAGES.delete(row.track_key);
  await env.DB.prepare("DELETE FROM tours WHERE id = ?").bind(id).run();
  return { ok: true };
}

/** For account deletion: every track file of a user. */
export async function trackKeysOf(env: CommunityEnv, userId: number): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT track_key FROM tours WHERE user_id = ?").bind(userId).all<{ track_key: string }>();
  return rows.results.map((r) => r.track_key);
}
