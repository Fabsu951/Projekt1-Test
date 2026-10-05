import { currentUser, requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { d1Store, enforce, record } from "./rateLimit";
import { distanceM } from "./track";
import { nearestRegion } from "./tours";
import { socialCleanup } from "./socialCleanup";

// Planned routes: saved on the account, private unless shared by link.
// There is deliberately no public list of other people's routes.

export const MAX_WAYPOINTS = 300;
const MAX_ROUTES_PER_USER = 300;
const MAX_TITLE = 100;
const SAVE_LIMIT = { max: 120, windowMs: 60 * 60 * 1000 };

type LatLon = [number, number];

export interface RouteRow {
  id: number;
  user_id: number;
  title: string;
  waypoints: string;
  distance_m: number;
  ascent_m: number | null;
  descent_m: number | null;
  region_id: string | null;
  shared: number;
  created_at: string;
  updated_at: string;
}

export interface PlannedRoute {
  id: number;
  title: string;
  waypoints: LatLon[];
  distanceM: number;
  ascentM: number | null;
  descentM: number | null;
  regionId: string | null;
  shared: boolean;
  /** True when the person asking owns the route. */
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toRoute(row: RouteRow, viewerId: number | null): PlannedRoute {
  return {
    id: row.id,
    title: row.title,
    waypoints: JSON.parse(row.waypoints) as LatLon[],
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    descentM: row.descent_m,
    regionId: row.region_id,
    shared: row.shared === 1,
    mine: viewerId === row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Validates the clicked points: 2–300 of them, inside the world. */
export function cleanWaypoints(raw: unknown): LatLon[] {
  if (!Array.isArray(raw) || raw.length < 2) throw new HttpError(400, "En rutt behöver minst två punkter.");
  if (raw.length > MAX_WAYPOINTS) throw new HttpError(400, `En rutt kan ha högst ${MAX_WAYPOINTS} punkter.`);
  return raw.map((p) => {
    if (!Array.isArray(p) || p.length !== 2) throw new HttpError(400, "Ogiltig punkt i rutten.");
    const [lat, lon] = p.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
      throw new HttpError(400, "Ogiltig punkt i rutten.");
    }
    return [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6] as LatLon;
  });
}

/** Height numbers come from the app's elevation lookup; keep them plausible. */
function metres(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) || n < 0 || n > 30000 ? null : Math.round(n);
}

function title(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new HttpError(400, "Ge rutten ett namn.");
  if (s.length > MAX_TITLE) throw new HttpError(400, `Namnet får vara högst ${MAX_TITLE} tecken.`);
  return s;
}

function routeLength(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceM([...points[i - 1], null, null], [...points[i], null, null]);
  return Math.round(total);
}

interface RouteBody {
  title?: unknown;
  waypoints?: unknown;
  ascentM?: unknown;
  descentM?: unknown;
  shared?: unknown;
}

export async function createRoute(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const store = d1Store(env.DB);
  const key = `route-save:${user.id}`;
  await enforce(store, [{ key, ...SAVE_LIMIT }], "Du har sparat väldigt många rutter den senaste timmen. Försök igen senare.");
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM routes WHERE user_id = ?").bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ROUTES_PER_USER) {
    throw new HttpError(400, `Du kan ha högst ${MAX_ROUTES_PER_USER} sparade rutter. Ta bort några gamla först.`);
  }

  const body = await readJson<RouteBody>(request);
  const points = cleanWaypoints(body.waypoints);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO routes (user_id, title, waypoints, distance_m, ascent_m, descent_m, region_id, shared, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user.id,
      title(body.title),
      JSON.stringify(points),
      routeLength(points),
      metres(body.ascentM),
      metres(body.descentM),
      nearestRegion([...points[0], null, null]),
      body.shared === true ? 1 : 0,
      now,
      now
    )
    .run();
  await record(store, [key]);
  return { route: toRoute(await getRow(env, Number(result.meta.last_row_id)), user.id) };
}

export async function listMyRoutes(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT * FROM routes WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
    .bind(user.id, MAX_ROUTES_PER_USER)
    .all<RouteRow>();
  return { routes: rows.results.map((r) => toRoute(r, user.id)) };
}

async function getRow(env: CommunityEnv, id: number): Promise<RouteRow> {
  const row = await env.DB.prepare("SELECT * FROM routes WHERE id = ?").bind(id).first<RouteRow>();
  if (!row) throw new HttpError(404, "Rutten finns inte.");
  return row;
}

/** The owner always; anyone else only when the route is shared by link. */
export async function getRoute(request: Request, env: CommunityEnv, id: number) {
  const row = await getRow(env, id);
  const viewer = await currentUser(request, env);
  if (!row.shared && viewer?.id !== row.user_id) throw new HttpError(404, "Rutten finns inte eller är inte delad.");
  return { route: toRoute(row, viewer?.id ?? null) };
}

export async function updateRoute(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (row.user_id !== user.id) throw new HttpError(403, "Du kan bara ändra dina egna rutter.");
  const body = await readJson<RouteBody>(request);

  const points = body.waypoints === undefined ? (JSON.parse(row.waypoints) as LatLon[]) : cleanWaypoints(body.waypoints);
  const moved = body.waypoints !== undefined;
  await env.DB.prepare(
    `UPDATE routes SET title = ?, waypoints = ?, distance_m = ?, ascent_m = ?, descent_m = ?, region_id = ?,
       shared = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      body.title === undefined ? row.title : title(body.title),
      JSON.stringify(points),
      routeLength(points),
      moved ? metres(body.ascentM) : row.ascent_m,
      moved ? metres(body.descentM) : row.descent_m,
      nearestRegion([...points[0], null, null]),
      body.shared === undefined ? row.shared : body.shared === true ? 1 : 0,
      nowIso(),
      id
    )
    .run();
  return { route: toRoute(await getRow(env, id), user.id) };
}

export async function deleteRoute(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (row.user_id !== user.id) throw new HttpError(403, "Du kan bara ta bort dina egna rutter.");
  await env.DB.batch([env.DB.prepare("DELETE FROM routes WHERE id = ?").bind(id), ...socialCleanup(env, "route", id)]);
  return { ok: true };
}
