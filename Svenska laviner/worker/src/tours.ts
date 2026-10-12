import { currentUser, requirePoster, requireUser, type CommunityEnv, type User } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { socialCleanup } from "./socialCleanup";
import { d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";
import { cleanPoints, distanceM, previewLine, trackStats, trimEnds, type TrackPoint } from "./track";
import { cleanDangerSigns, type DangerSign } from "./observations";
import { blockedBetween, notBlockedSql } from "./blocks";

export const HIDE_ENDS_OPTIONS = [0, 200, 500, 1000] as const;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 4000;
/** A tour belongs to the nearest forecast region within this distance of its start. */
const REGION_RADIUS_M = 80_000;
const UPLOAD_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

export interface TourRow {
  id: number;
  user_id: number;
  display_name: string;
  author_is_admin?: number;
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
  followers_only: number;
  pin_lat: number | null;
  pin_lon: number | null;
  track_key: string;
  preview: string | null;
  danger_signs?: string | null;
  created_at: string;
}

export interface Tour {
  id: number;
  userId: number;
  author: string;
  authorIsAdmin: boolean;
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
  /** Who sees it: everyone, the owner's followers, or only the owner. */
  visibility: Visibility;
  hideEndsM: number;
  /** Where to put the tour on a map (after the hidden start), or null if nothing is shown. */
  pin: [number, number] | null;
  /** Warning signs seen on the tour: null = not answered, [] = none seen. */
  dangerSigns: DangerSign[] | null;
  createdAt: string;
}

export type Visibility = "public" | "followers" | "private";

function visibilityOf(row: Pick<TourRow, "shared" | "followers_only">): Visibility {
  return row.shared !== 1 ? "private" : row.followers_only === 1 ? "followers" : "public";
}

/** The request's choice as stored flags; falls back to the older `shared` boolean. */
function readVisibility(body: { visibility?: unknown; shared?: unknown }, fallback: Visibility): Visibility {
  if (body.visibility === "public" || body.visibility === "followers" || body.visibility === "private") return body.visibility;
  if (body.shared === true) return "public";
  if (body.shared === false) return "private";
  return fallback;
}

/**
 * SQL that keeps only tours the viewer may see besides their own: public
 * ones, and followers-only ones from people the viewer follows.
 */
export function visibleTourSql(alias: string, viewerId: number | null): { sql: string; binds: unknown[] } {
  const viewer = viewerId ?? -1;
  return {
    sql: `(${alias}.user_id = ? OR (${alias}.shared = 1 AND (${alias}.followers_only = 0 OR EXISTS (
      SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = ${alias}.user_id))))`,
    binds: [viewer, viewer],
  };
}

export function toTour(row: TourRow): Tour {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.display_name,
    authorIsAdmin: row.author_is_admin === 1,
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
    visibility: visibilityOf(row),
    hideEndsM: row.hide_ends_m,
    pin: row.pin_lat !== null && row.pin_lon !== null ? [row.pin_lat, row.pin_lon] : null,
    dangerSigns: storedSigns(row.danger_signs ?? null),
    createdAt: row.created_at,
  };
}

export const SELECT_TOURS = "SELECT t.*, u.display_name, u.is_admin AS author_is_admin FROM tours t JOIN users u ON u.id = t.user_id";
const SELECT = SELECT_TOURS;

export function nearestRegion(point: TrackPoint): string | null {
  let best: { id: string; d: number } | null = null;
  for (const r of REGION_SOURCES) {
    const d = distanceM(point, [r.lat, r.lon, null, null]);
    if (!best || d < best.d) best = { id: r.id, d };
  }
  return best && best.d <= REGION_RADIUS_M ? best.id : null;
}

function storedSigns(json: string | null): DangerSign[] | null {
  if (json === null) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? cleanDangerSigns(parsed) : null;
  } catch {
    return null;
  }
}

/** The request's warning signs as stored text: null = not answered, "[]" = none seen. */
function readSigns(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new HttpError(400, "Ogiltiga varningstecken.");
  return JSON.stringify(cleanDangerSigns(value));
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
  /** "public" | "followers" | "private"; replaces `shared`. */
  visibility?: unknown;
  hideEndsM?: unknown;
  /** Used when the track itself has no timestamps, as YYYY-MM-DD. */
  date?: unknown;
  points?: unknown;
  /** Where an imported tour came from, e.g. "hc:<session id>"; one tour per source per person. */
  sourceRef?: unknown;
  /** Save even though a tour starting at the same time already exists. */
  allowDuplicate?: unknown;
  /** Warning signs seen: an array of sign ids ([] = none seen), or null for not answered. */
  dangerSigns?: unknown;
}

/** Tours this close in start time, with lengths this close, count as the same outing. */
const SAME_START_MS = 15 * 60 * 1000;
const SAME_LENGTH = { share: 0.3, metres: 1000 };

/** One of your tours that looks like the same outing (another file of it, or another app's copy). */
async function similarTour(env: CommunityEnv, userId: number, startedAt: string, distanceM: number) {
  const t = Date.parse(startedAt);
  const rows = await env.DB.prepare(
    "SELECT id, title, started_at, distance_m FROM tours WHERE user_id = ? AND started_at BETWEEN ? AND ?"
  )
    .bind(userId, new Date(t - SAME_START_MS).toISOString(), new Date(t + SAME_START_MS).toISOString())
    .all<{ id: number; title: string; started_at: string; distance_m: number }>();
  const close = rows.results.find(
    (r) => Math.abs(r.distance_m - distanceM) <= Math.max(SAME_LENGTH.metres, SAME_LENGTH.share * Math.max(r.distance_m, distanceM))
  );
  return close ? { id: close.id, title: close.title, startedAt: close.started_at } : null;
}

const SOURCE_REF = /^[a-z]{2,10}:[\w.:-]{1,190}$/;

function readSourceRef(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !SOURCE_REF.test(value)) throw new HttpError(400, "Ogiltig källa för turen.");
  return value;
}

async function tourFromSource(env: CommunityEnv, userId: number, ref: string) {
  const row = await env.DB.prepare(`${SELECT} WHERE t.user_id = ? AND t.source_ref = ?`).bind(userId, ref).first<TourRow>();
  return row ? toTour(row) : null;
}

/** The sources (with this prefix, e.g. "hc") of the tours you've imported, so the app can skip them. */
export async function importedSources(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const prefix = new URL(request.url).searchParams.get("prefix") ?? "";
  if (!/^[a-z]{0,10}$/.test(prefix)) throw new HttpError(400, "Ogiltigt prefix.");
  const rows = await env.DB.prepare(
    "SELECT source_ref FROM tours WHERE user_id = ? AND source_ref LIKE ? ORDER BY id DESC LIMIT 2000"
  )
    .bind(user.id, `${prefix}%`)
    .all<{ source_ref: string }>();
  return { refs: rows.results.map((r) => r.source_ref) };
}

export async function createTour(request: Request, env: CommunityEnv) {
  const user = await requirePoster(request, env);
  const body = await readJson<CreateBody>(request);
  // The same watch session again (another phone, a retry): hand back the tour we already have.
  const sourceRef = readSourceRef(body.sourceRef);
  if (sourceRef) {
    const existing = await tourFromSource(env, user.id, sourceRef);
    if (existing) return { tour: existing, duplicate: true };
  }

  const store = d1Store(env.DB);
  const key = `tour-upload:${user.id}`;
  await enforce(store, [{ key, ...UPLOAD_LIMIT }], "Du har laddat upp många turer den senaste timmen. Försök igen senare.");

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
  // Only tracks with real times are compared; a date alone says too little.
  if (stats.startedAt && body.allowDuplicate !== true) {
    const similar = await similarTour(env, user.id, stats.startedAt, stats.distanceM);
    if (similar) {
      throw new HttpError(409, `Du har redan en tur som startade samtidigt: ”${similar.title}”.`, { similarTo: similar });
    }
  }

  const visibility = readVisibility(body, "public");
  const signs = readSigns(body.dangerSigns);
  const hide = hideEnds(body.hideEndsM);
  const pin = publicPin(points, hide);
  const preview = previewLine(points, hide);
  const trackKey = `tracks/${crypto.randomUUID()}.json`;
  await env.IMAGES.put(trackKey, JSON.stringify(points), { httpMetadata: { contentType: "application/json" } });

  const result = await env.DB.prepare(
    `INSERT INTO tours (user_id, title, description, started_at, duration_s, distance_m, ascent_m, descent_m,
       max_elevation_m, region_id, shared, followers_only, hide_ends_m, pin_lat, pin_lon, track_key, preview, source_ref, danger_signs, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      visibility === "private" ? 0 : 1,
      visibility === "followers" ? 1 : 0,
      hide,
      pin?.[0] ?? null,
      pin?.[1] ?? null,
      trackKey,
      preview ? JSON.stringify(preview) : null,
      sourceRef,
      signs,
      nowIso()
    )
    .run()
    .catch(async (err) => {
      // Two uploads of the same session at once: keep the first.
      const existing = sourceRef ? await tourFromSource(env, user.id, sourceRef) : null;
      if (!existing) throw err;
      await env.IMAGES.delete(trackKey);
      return null;
    });
  if (!result) return { tour: (await tourFromSource(env, user.id, sourceRef!))!, duplicate: true };
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
    const viewer = await currentUser(request, env);
    const visible = visibleTourSql("t", viewer?.id ?? null);
    // Lists of others' tours never include private ones, not even your own.
    where.push("t.shared = 1", visible.sql);
    binds.push(...visible.binds);
    if (viewer) {
      where.push(notBlockedSql("t.user_id"));
      binds.push(viewer.id, viewer.id);
    }
    const author = Number(url.searchParams.get("user"));
    if (Number.isInteger(author) && author > 0) {
      where.push("t.user_id = ?");
      binds.push(author);
    }
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
  // Followers-only tours stay out of the public heatmap.
  const where = ["t.shared = 1", "t.followers_only = 0", "t.preview IS NOT NULL"];
  const binds: unknown[] = [];
  const viewer = await currentUser(request, env);
  if (viewer) {
    where.push(notBlockedSql("t.user_id"));
    binds.push(viewer.id, viewer.id);
  }
  addFilters(url, where, binds);
  const rows = await env.DB.prepare(
    `SELECT t.id, t.title, t.started_at, t.preview FROM tours t WHERE ${where.join(" AND ")} ORDER BY t.started_at DESC LIMIT ?`
  )
    .bind(...binds, HEATMAP_LIMIT)
    .all<{ id: number; title: string; started_at: string; preview: string }>();
  return {
    lines: rows.results.map((r) => ({
      id: r.id,
      title: r.title,
      startedAt: r.started_at,
      points: JSON.parse(r.preview) as Array<[number, number]>,
    })),
  };
}

async function getRow(env: CommunityEnv, id: number): Promise<TourRow> {
  const row = await env.DB.prepare(`${SELECT} WHERE t.id = ?`).bind(id).first<TourRow>();
  if (!row) throw new HttpError(404, "Turen finns inte.");
  return row;
}

/** The owner always; others when it's public, or followers-only and they follow the owner. */
export async function canSeeTour(
  env: CommunityEnv,
  row: Pick<TourRow, "user_id" | "shared" | "followers_only">,
  viewerId: number | null
): Promise<boolean> {
  if (viewerId === row.user_id) return true;
  if (row.shared !== 1) return false;
  if (row.followers_only !== 1) return true;
  if (viewerId === null) return false;
  const f = await env.DB.prepare("SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?")
    .bind(viewerId, row.user_id)
    .first();
  return f !== null;
}

const canModify = (user: User, row: TourRow) => user.isAdmin || user.id === row.user_id;

/** The tour and its track: whole for the owner, with hidden ends for everyone else. */
export async function getTour(request: Request, env: CommunityEnv, id: number) {
  const row = await getRow(env, id);
  const viewer = await currentUser(request, env);
  const isOwner = viewer?.id === row.user_id;
  if (!(await canSeeTour(env, row, viewer?.id ?? null))) throw new HttpError(404, "Turen finns inte.");
  if (viewer && !viewer.isAdmin && (await blockedBetween(env, viewer.id, row.user_id))) throw new HttpError(404, "Turen finns inte.");

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
  const visibility = readVisibility(body, visibilityOf(row));
  const hide = body.hideEndsM === undefined ? row.hide_ends_m : hideEnds(body.hideEndsM);
  const signs = body.dangerSigns === undefined ? (row.danger_signs ?? null) : readSigns(body.dangerSigns);

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
    "UPDATE tours SET title = ?, description = ?, shared = ?, followers_only = ?, hide_ends_m = ?, pin_lat = ?, pin_lon = ?, preview = ?, danger_signs = ? WHERE id = ?"
  )
    .bind(title, description, visibility === "private" ? 0 : 1, visibility === "followers" ? 1 : 0, hide, pin?.[0] ?? null, pin?.[1] ?? null, preview, signs, id)
    .run();
  return { tour: toTour(await getRow(env, id)) };
}

export async function deleteTour(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (!canModify(user, row)) throw new HttpError(403, "Du kan bara ta bort dina egna turer.");
  await env.IMAGES.delete(row.track_key);
  await env.DB.batch([env.DB.prepare("DELETE FROM tours WHERE id = ?").bind(id), ...socialCleanup(env, "tour", id)]);
  return { ok: true };
}

/** For account deletion: every track file of a user. */
export async function trackKeysOf(env: CommunityEnv, userId: number): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT track_key FROM tours WHERE user_id = ?").bind(userId).all<{ track_key: string }>();
  return rows.results.map((r) => r.track_key);
}
