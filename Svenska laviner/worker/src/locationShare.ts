import { requireUser, type CommunityEnv } from "./auth";
import { notBlockedSql } from "./blocks";
import { HttpError, readJson } from "./http";
import { toLang, type Lang } from "./lang";
import { stockholmDate } from "./model";
import { notify, type Defer, type NotifyEnv } from "./notifications";
import { badgesOf } from "./profile";
import { d1Store, enforce, record } from "./rateLimit";

// "Dela position": for a few hours, the people you pick (your company on
// today's tour day, or people you follow) can see where you last were. Only
// the latest point is stored – no trail – and everything is deleted when the
// share ends or is stopped. It needs mobile coverage, so it is no substitute
// for an avalanche transceiver; the app says so wherever it is offered.

export const MAX_SHARE_HOURS = 12;
const MAX_VIEWERS = 20;
const START_LIMIT = { max: 20, windowMs: 3600 * 1000 };

export interface SharePerson {
  id: number;
  displayName: string;
  avatarPath: string | null;
  xp: number;
  isAdmin: boolean;
}

export interface Candidate extends SharePerson {
  /** On a tour day with you today (your company). */
  companion: boolean;
}

export interface SharedPosition {
  lat: number;
  lon: number;
  /** Metres, as the phone reported it. */
  accuracy: number | null;
  at: string;
}

interface ShareRow {
  user_id: number;
  started_at: string;
  ends_at: string;
  lat: number | null;
  lon: number | null;
  accuracy: number | null;
  position_at: string | null;
}

const positionOf = (r: ShareRow): SharedPosition | null =>
  r.lat === null || r.lon === null || r.position_at === null ? null : { lat: r.lat, lon: r.lon, accuracy: r.accuracy, at: r.position_at };

/** Shares that have ended are deleted, positions and all. */
export async function pruneShares(env: CommunityEnv, now = new Date()): Promise<void> {
  const at = now.toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM location_share_viewers WHERE user_id IN (SELECT user_id FROM location_shares WHERE ends_at <= ?)").bind(at),
    env.DB.prepare("DELETE FROM location_shares WHERE ends_at <= ?").bind(at),
  ]);
}

async function withBadges<T extends { id: number }>(env: CommunityEnv, people: T[]): Promise<Array<T & Omit<SharePerson, "id" | "displayName">>> {
  const badges = await badgesOf(env, people.map((p) => p.id));
  return people.map((p) => ({ ...p, avatarPath: badges[p.id]?.avatarPath ?? null, xp: badges[p.id]?.xp ?? 0, isAdmin: badges[p.id]?.isAdmin ?? false }));
}

/** Who you may share with: today's tour company first, then people you follow. */
async function candidatesOf(env: CommunityEnv, me: number, now: Date): Promise<Candidate[]> {
  const today = stockholmDate(now);
  const rows = await env.DB.prepare(
    `WITH company AS (
       -- You invited them, or they invited you, and the invitation was accepted.
       SELECT CASE WHEN i.from_user = ?1 THEN i.to_user ELSE i.from_user END AS id
         FROM trip_invites i JOIN trip_plans t ON t.id = i.trip_id
        WHERE i.status = 'accepted' AND t.date = ?2 AND (i.from_user = ?1 OR i.to_user = ?1)
       UNION
       -- Others who accepted the same invitation as you.
       SELECT other.to_user FROM trip_invites mine
         JOIN trip_invites other ON other.trip_id = mine.trip_id AND other.status = 'accepted'
         JOIN trip_plans t ON t.id = mine.trip_id
        WHERE mine.to_user = ?1 AND mine.status = 'accepted' AND t.date = ?2
     )
     SELECT u.id, u.display_name, EXISTS (SELECT 1 FROM company c WHERE c.id = u.id) AS companion
       FROM users u
      WHERE u.id != ?1
        AND (u.id IN (SELECT id FROM company) OR u.id IN (SELECT followee_id FROM follows WHERE follower_id = ?1))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocked_id = ?1 AND b.blocker_id = u.id))
      ORDER BY companion DESC, u.display_name COLLATE NOCASE
      LIMIT 500`
  )
    .bind(me, today)
    .all<{ id: number; display_name: string; companion: number }>();
  return withBadges(
    env,
    rows.results.map((r) => ({ id: r.id, displayName: r.display_name, companion: r.companion === 1 }))
  );
}

async function activeShare(env: CommunityEnv, me: number, now: Date) {
  const row = await env.DB.prepare("SELECT * FROM location_shares WHERE user_id = ? AND ends_at > ?").bind(me, now.toISOString()).first<ShareRow>();
  if (!row) return null;
  const viewers = await env.DB.prepare(
    `SELECT u.id, u.display_name FROM location_share_viewers v JOIN users u ON u.id = v.viewer_id
      WHERE v.user_id = ? ORDER BY u.display_name COLLATE NOCASE`
  )
    .bind(me)
    .all<{ id: number; display_name: string }>();
  return {
    startedAt: row.started_at,
    endsAt: row.ends_at,
    position: positionOf(row),
    viewers: await withBadges(env, viewers.results.map((v) => ({ id: v.id, displayName: v.display_name }))),
  };
}

/** GET /location/share: your current share (or null) and who you can share with. */
export async function myShare(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  return { share: await activeShare(env, me.id, now), candidates: await candidatesOf(env, me.id, now) };
}

function shareText(lang: Lang, name: string, endsAt: Date): string {
  const until = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(endsAt);
  return lang === "en" ? `${name} is sharing their location with you until ${until}.` : `${name} delar sin position med dig till kl. ${until}.`;
}

/**
 * POST /location/share {viewerIds, hours}: starts sharing (or changes who
 * sees it and for how long). A new share starts without a position; the app
 * sends one straight away. Newly added viewers get a notification.
 */
export async function startShare(request: Request, env: NotifyEnv, defer?: Defer, now = new Date()) {
  const me = await requireUser(request, env);
  const body = await readJson<{ viewerIds?: unknown; hours?: unknown }>(request);
  const hours = Number(body.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SHARE_HOURS) {
    throw new HttpError(400, `Välj mellan 1 och ${MAX_SHARE_HOURS} timmar.`);
  }
  const wanted = new Set(Array.isArray(body.viewerIds) ? body.viewerIds.map(Number).filter((id) => Number.isInteger(id)) : []);
  if (wanted.size > MAX_VIEWERS) throw new HttpError(400, `Du kan dela med högst ${MAX_VIEWERS} personer åt gången.`);
  const viewers = (await candidatesOf(env, me.id, now)).filter((c) => wanted.has(c.id));
  if (viewers.length === 0) throw new HttpError(400, "Välj vem som får se din position.");

  const store = d1Store(env.DB);
  const key = `location-share:${me.id}`;
  await enforce(store, [{ key, ...START_LIMIT }], "Du har startat många delningar den senaste timmen. Försök igen om en stund.");
  await record(store, [key]);

  const before = await activeShare(env, me.id, now);
  const already = new Set(before?.viewers.map((v) => v.id) ?? []);
  const endsAt = new Date(now.getTime() + hours * 3600 * 1000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM location_share_viewers WHERE user_id = ?").bind(me.id),
    env.DB.prepare("DELETE FROM location_shares WHERE user_id = ?").bind(me.id),
    env.DB.prepare("INSERT INTO location_shares (user_id, started_at, ends_at) VALUES (?, ?, ?)").bind(me.id, now.toISOString(), endsAt.toISOString()),
    ...viewers.map((v) => env.DB.prepare("INSERT INTO location_share_viewers (user_id, viewer_id) VALUES (?, ?)").bind(me.id, v.id)),
  ]);

  const added = viewers.filter((v) => !already.has(v.id));
  if (added.length) {
    const langs = await env.DB.prepare(`SELECT id, lang FROM users WHERE id IN (${added.map(() => "?").join(", ")})`)
      .bind(...added.map((v) => v.id))
      .all<{ id: number; lang: string }>();
    const langOf = new Map(langs.results.map((r) => [r.id, toLang(r.lang)]));
    await notify(
      env,
      added.map((v) => ({
        userId: v.id,
        kind: "location_share" as const,
        actorId: me.id,
        note: shareText(langOf.get(v.id) ?? "sv", me.displayName, endsAt),
        url: "/karta?kompisar=1",
      })),
      defer
    );
  }
  return { share: await activeShare(env, me.id, now) };
}

/** POST /location/position {lat, lon, accuracy}: the latest point of your running share. */
export async function updatePosition(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  const body = await readJson<{ lat?: unknown; lon?: unknown; accuracy?: unknown }>(request);
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new HttpError(400, "Ogiltig position.");
  }
  const acc = body.accuracy === undefined || body.accuracy === null ? null : Number(body.accuracy);
  const accuracy = acc !== null && Number.isFinite(acc) && acc >= 0 ? Math.min(Math.round(acc), 100_000) : null;
  const result = await env.DB.prepare(
    "UPDATE location_shares SET lat = ?, lon = ?, accuracy = ?, position_at = ? WHERE user_id = ? AND ends_at > ?"
  )
    .bind(Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6, accuracy, now.toISOString(), me.id, now.toISOString())
    .run();
  if (!result.meta.changes) throw new HttpError(404, "Du delar inte din position just nu.");
  const row = await env.DB.prepare("SELECT ends_at FROM location_shares WHERE user_id = ?").bind(me.id).first<{ ends_at: string }>();
  return { endsAt: row?.ends_at ?? null };
}

/** DELETE /location/share: stops sharing and deletes the position. */
export async function stopShare(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM location_share_viewers WHERE user_id = ?").bind(me.id),
    env.DB.prepare("DELETE FROM location_shares WHERE user_id = ?").bind(me.id),
  ]);
  return { ok: true };
}

/** GET /location/shared-with-me: people sharing their position with you right now. */
export async function sharedWithMe(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  await pruneShares(env, now);
  const rows = await env.DB.prepare(
    `SELECT s.*, u.display_name FROM location_share_viewers v
       JOIN location_shares s ON s.user_id = v.user_id
       JOIN users u ON u.id = s.user_id
      WHERE v.viewer_id = ? AND s.ends_at > ? AND ${notBlockedSql("s.user_id")}
      ORDER BY u.display_name COLLATE NOCASE`
  )
    .bind(me.id, now.toISOString(), me.id, me.id)
    .all<ShareRow & { display_name: string }>();
  const people = await withBadges(
    env,
    rows.results.map((r) => ({ id: r.user_id, displayName: r.display_name, startedAt: r.started_at, endsAt: r.ends_at, position: positionOf(r) }))
  );
  return { people };
}
