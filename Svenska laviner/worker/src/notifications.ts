import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { badgesOf } from "./profile";
import type { ItemType } from "./socialCleanup";
import { isPushEndpoint, sendPush, vapidConfigured, type VapidEnv } from "./webpush";

// Notifications about people: new followers, comments and likes on your
// things, and replies in comment threads you've joined. Always stored for
// the bell in the app; also sent as web push to browsers the user has
// turned that on for.

export type NotificationKind = "follow" | "comment" | "reply" | "like";
export type NotifyEnv = CommunityEnv & VapidEnv;
/** Runs work after the response is sent (ctx.waitUntil in the worker). */
export type Defer = (work: Promise<unknown>) => void;

interface NewNotification {
  userId: number;
  kind: NotificationKind;
  actorId: number;
  itemType?: ItemType;
  itemId?: number;
}

/** Re-follows and repeated likes within this window don't notify again. */
const REPEAT_WINDOW_MS = 24 * 3600 * 1000;
/** Old notifications are pruned so the table stays small. */
const KEEP_DAYS = 90;
const MAX_LIST = 50;

/**
 * Stores notifications (skipping yourself and recent duplicates) and sends
 * push in the background.
 */
export async function notify(env: NotifyEnv, list: NewNotification[], defer?: Defer): Promise<void> {
  const now = nowIso();
  const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString();
  const stored: Array<NewNotification & { id: number }> = [];
  for (const n of list) {
    if (n.userId === n.actorId) continue;
    if (n.kind === "follow" || n.kind === "like") {
      const recent = await env.DB.prepare(
        `SELECT 1 AS x FROM notifications WHERE user_id = ? AND kind = ? AND actor_id = ?
           AND COALESCE(item_type, '') = ? AND COALESCE(item_id, 0) = ? AND created_at > ?`
      )
        .bind(n.userId, n.kind, n.actorId, n.itemType ?? "", n.itemId ?? 0, since)
        .first();
      if (recent) continue;
    }
    const r = await env.DB.prepare(
      "INSERT INTO notifications (user_id, kind, actor_id, item_type, item_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(n.userId, n.kind, n.actorId, n.itemType ?? null, n.itemId ?? null, now)
      .run();
    stored.push({ ...n, id: Number(r.meta.last_row_id) });
  }
  if (stored.length && vapidConfigured(env)) {
    const work = sendPushes(env, stored);
    if (defer) defer(work);
    else await work;
  }
}

async function sendPushes(env: NotifyEnv, list: Array<NewNotification & { id: number }>) {
  const gone: string[] = [];
  for (const n of list) {
    const subs = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM user_push_subscriptions WHERE user_id = ?")
      .bind(n.userId)
      .all<{ endpoint: string; p256dh: string; auth: string }>();
    if (subs.results.length === 0) continue;
    const [view] = await describe(env, [{ ...n, created_at: "", read_at: null }]);
    for (const sub of subs.results) {
      const result = await sendPush(env, sub, { title: "Toppkoll", body: view.text, url: view.url, tag: `social-${n.id}` });
      if (result === "gone") gone.push(sub.endpoint);
    }
  }
  if (gone.length) {
    await env.DB.batch(gone.map((e) => env.DB.prepare("DELETE FROM user_push_subscriptions WHERE endpoint = ?").bind(e)));
  }
}

interface Row {
  id: number;
  kind: NotificationKind;
  actorId: number;
  itemType?: ItemType | null;
  itemId?: number | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationView {
  id: number;
  kind: NotificationKind;
  actor: { id: number; displayName: string };
  /** Ready-made Swedish sentence, e.g. "Anna kommenterade din tur ”Sydtoppen”". */
  text: string;
  /** Where tapping it leads, a path in the app. */
  url: string;
  createdAt: string;
  read: boolean;
}

const OBSERVATION_LABEL = "observation";

/** Names, item titles and links for a set of notification rows. */
async function describe(env: CommunityEnv, rows: Row[]): Promise<NotificationView[]> {
  const actorIds = [...new Set(rows.map((r) => r.actorId))];
  const names = new Map<number, string>();
  if (actorIds.length) {
    const res = await env.DB.prepare(`SELECT id, display_name FROM users WHERE id IN (${actorIds.map(() => "?").join(", ")})`)
      .bind(...actorIds)
      .all<{ id: number; display_name: string }>();
    for (const r of res.results) names.set(r.id, r.display_name);
  }
  const titles = new Map<string, string>();
  for (const [type, table] of [["tour", "tours"], ["route", "routes"]] as const) {
    const ids = [...new Set(rows.filter((r) => r.itemType === type).map((r) => r.itemId!))];
    if (!ids.length) continue;
    const res = await env.DB.prepare(`SELECT id, title FROM ${table} WHERE id IN (${ids.map(() => "?").join(", ")})`)
      .bind(...ids)
      .all<{ id: number; title: string }>();
    for (const r of res.results) titles.set(`${type}:${r.id}`, r.title);
  }

  return rows.map((r) => {
    const who = names.get(r.actorId) ?? "Någon";
    const title = r.itemType && r.itemId ? titles.get(`${r.itemType}:${r.itemId}`) : undefined;
    const thing =
      r.itemType === "tour"
        ? `din tur${title ? ` ”${title}”` : ""}`
        : r.itemType === "route"
          ? `din rutt${title ? ` ”${title}”` : ""}`
          : `din ${OBSERVATION_LABEL}`;
    const where =
      r.itemType === "tour"
        ? `turen${title ? ` ”${title}”` : ""}`
        : r.itemType === "route"
          ? `rutten${title ? ` ”${title}”` : ""}`
          : "en observation";
    const text =
      r.kind === "follow"
        ? `${who} började följa dig`
        : r.kind === "comment"
          ? `${who} kommenterade ${thing}`
          : r.kind === "reply"
            ? `${who} svarade på ${where}`
            : `${who} gillade ${thing}`;
    const url =
      r.kind === "follow"
        ? `/person/${r.actorId}`
        : r.itemType === "tour"
          ? `/turer/${r.itemId}`
          : r.itemType === "route"
            ? `/karta?rutt=${r.itemId}`
            : "/flode";
    return {
      id: r.id,
      kind: r.kind,
      actor: { id: r.actorId, displayName: who },
      text,
      url,
      createdAt: r.created_at,
      read: r.read_at !== null,
    };
  });
}

export async function listNotifications(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  await env.DB.prepare("DELETE FROM notifications WHERE user_id = ? AND created_at < ?")
    .bind(me.id, new Date(Date.now() - KEEP_DAYS * 864e5).toISOString())
    .run();
  const rows = await env.DB.prepare(
    `SELECT id, kind, actor_id AS actorId, item_type AS itemType, item_id AS itemId, created_at, read_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
  )
    .bind(me.id, MAX_LIST)
    .all<Row>();
  const notifications = await describe(env, rows.results);
  return {
    notifications,
    unread: await unreadCount(env, me.id),
    people: await badgesOf(env, notifications.map((n) => n.actor.id)),
  };
}

async function unreadCount(env: CommunityEnv, userId: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL")
    .bind(userId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Cheap check for the bell in the menu. */
export async function unread(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  return { unread: await unreadCount(env, me.id) };
}

export async function markRead(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(nowIso(), me.id).run();
  return { unread: 0 };
}

interface PushBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  endpoint?: string;
}

/** Ties this browser's push subscription to the account (only when the user turns it on). */
export async function subscribeUserPush(request: Request, env: NotifyEnv) {
  const me = await requireUser(request, env);
  if (!vapidConfigured(env)) throw new HttpError(503, "Notiser är inte aktiverade ännu.");
  const body = await readJson<PushBody>(request);
  const endpoint = body.subscription?.endpoint ?? "";
  const p256dh = body.subscription?.keys?.p256dh ?? "";
  const auth = body.subscription?.keys?.auth ?? "";
  if (!isPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) {
    throw new HttpError(400, "Ogiltig prenumeration på notiser.");
  }
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_push_subscriptions WHERE user_id = ?").bind(me.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= 10) throw new HttpError(400, "Notiser är redan på i många webbläsare. Stäng av i någon först.");
  await env.DB.prepare(
    `INSERT INTO user_push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  )
    .bind(endpoint, me.id, p256dh, auth, nowIso())
    .run();
  return { enabled: true };
}

export async function unsubscribeUserPush(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  const body = await readJson<PushBody>(request);
  if (body.endpoint) {
    await env.DB.prepare("DELETE FROM user_push_subscriptions WHERE endpoint = ? AND user_id = ?").bind(body.endpoint, me.id).run();
  }
  return { enabled: false };
}

/** Whether this browser gets push for the signed-in account. */
export async function userPushStatus(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  const body = await readJson<PushBody>(request);
  const row = body.endpoint
    ? await env.DB.prepare("SELECT 1 AS x FROM user_push_subscriptions WHERE endpoint = ? AND user_id = ?").bind(body.endpoint, me.id).first()
    : null;
  return { enabled: row !== null };
}
