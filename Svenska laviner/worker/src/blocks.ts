import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso } from "./http";

// Blocking works both ways once it exists: neither person sees the other's
// tours, observations, comments or name in search, and neither can follow,
// comment on or like the other's things or send them notices. Only the one
// who blocked can lift it, and only they see that they did.

/**
 * SQL that is true when `column` (a user id) and the viewer have no block
 * between them. Bind the viewer's id twice, in the order the `?`s appear.
 */
export function notBlockedSql(column: string): string {
  return `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = ${column}) OR (b.blocked_id = ? AND b.blocker_id = ${column}))`;
}

/** Whether either of the two has blocked the other. */
export async function blockedBetween(env: CommunityEnv, a: number, b: number): Promise<boolean> {
  if (a === b) return false;
  const row = await env.DB.prepare(
    "SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)"
  )
    .bind(a, b, b, a)
    .first();
  return row !== null;
}

export async function iBlocked(env: CommunityEnv, me: number, them: number): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS x FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(me, them).first();
  return row !== null;
}

export async function block(request: Request, env: CommunityEnv, id: number) {
  const me = await requireUser(request, env);
  if (me.id === id) throw new HttpError(400, "Du kan inte blockera dig själv.");
  const exists = await env.DB.prepare("SELECT 1 AS x FROM users WHERE id = ?").bind(id).first();
  if (!exists) throw new HttpError(404, "Personen finns inte.");
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").bind(me.id, id, nowIso()),
    env.DB.prepare("DELETE FROM follows WHERE (follower_id = ?1 AND followee_id = ?2) OR (follower_id = ?2 AND followee_id = ?1)").bind(me.id, id),
    env.DB.prepare("DELETE FROM location_share_viewers WHERE (user_id = ?1 AND viewer_id = ?2) OR (user_id = ?2 AND viewer_id = ?1)").bind(me.id, id),
    env.DB.prepare("DELETE FROM notifications WHERE (user_id = ?1 AND actor_id = ?2) OR (user_id = ?2 AND actor_id = ?1)").bind(me.id, id),
    env.DB.prepare(
      "DELETE FROM trip_invites WHERE status = 'pending' AND ((from_user = ?1 AND to_user = ?2) OR (from_user = ?2 AND to_user = ?1))"
    ).bind(me.id, id),
  ]);
  return { blocked: true };
}

export async function unblock(request: Request, env: CommunityEnv, id: number) {
  const me = await requireUser(request, env);
  await env.DB.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(me.id, id).run();
  return { blocked: false };
}
