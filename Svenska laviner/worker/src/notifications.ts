import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { badgesOf } from "./profile";
import type { ItemType } from "./socialCleanup";
import { fcmConfigured, type FcmEnv } from "./fcm";
import { sendNativeToUser } from "./nativePush";
import { isPushEndpoint, sendPush, vapidConfigured, type VapidEnv } from "./webpush";
import { userLang, type Lang } from "./lang";

// Notifications about people: new followers, comments and likes on your
// things, and replies in comment threads you've joined. Always stored for
// the bell in the app; also sent as web push to browsers the user has
// turned that on for.

/**
 * "moderation": an admin removed something of yours after a report; `note` says what and why.
 * "trip": the forecast for a tour you planned ("Prognos inför turen", trips.ts); `note` is the text.
 * "trip_invite" / "trip_join": an invitation to someone's tour day, or someone joining yours (tripInvites.ts); `note` is the text.
 */
export type NotificationKind = "follow" | "comment" | "reply" | "like" | "moderation" | "trip" | "trip_invite" | "trip_join";
export type NotifyEnv = CommunityEnv & VapidEnv & FcmEnv;
/** Runs work after the response is sent (ctx.waitUntil in the worker). */
export type Defer = (work: Promise<unknown>) => void;

interface NewNotification {
  userId: number;
  kind: NotificationKind;
  actorId: number;
  itemType?: ItemType;
  itemId?: number;
  note?: string;
  /** A link of its own (trip forecasts); otherwise it follows from the kind and item. */
  url?: string;
}

/** About yourself, from the app itself rather than another person. */
const SYSTEM_KINDS = new Set<NotificationKind>(["moderation", "trip"]);

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
    if (n.userId === n.actorId && n.kind !== "trip") continue;
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
      "INSERT INTO notifications (user_id, kind, actor_id, item_type, item_id, note, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(n.userId, n.kind, n.actorId, n.itemType ?? null, n.itemId ?? null, n.note ?? null, n.url ?? null, now)
      .run();
    stored.push({ ...n, id: Number(r.meta.last_row_id) });
  }
  if (stored.length && (vapidConfigured(env) || fcmConfigured(env))) {
    const work = sendPushes(env, stored);
    if (defer) defer(work);
    else await work;
  }
}

async function sendPushes(env: NotifyEnv, list: Array<NewNotification & { id: number }>) {
  const gone: string[] = [];
  for (const n of list) {
    const subs = vapidConfigured(env)
      ? await env.DB.prepare("SELECT endpoint, p256dh, auth FROM user_push_subscriptions WHERE user_id = ?")
          .bind(n.userId)
          .all<{ endpoint: string; p256dh: string; auth: string }>()
      : { results: [] };
    const devices = fcmConfigured(env)
      ? await env.DB.prepare("SELECT 1 AS x FROM native_devices WHERE user_id = ? LIMIT 1").bind(n.userId).first()
      : null;
    if (subs.results.length === 0 && !devices) continue;
    const [view] = await describe(env, [{ ...n, created_at: "", read_at: null }], await userLang(env.DB, n.userId));
    if (devices) await sendNativeToUser(env, n.userId, { title: "Snöläge", body: view.text, url: view.url, tag: `social-${n.id}` });
    for (const sub of subs.results) {
      const result = await sendPush(env, sub, { title: "Snöläge", body: view.text, url: view.url, tag: `social-${n.id}` });
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
  note?: string | null;
  url?: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationView {
  id: number;
  kind: NotificationKind;
  actor: { id: number; displayName: string };
  /** Ready-made sentence in the reader's language, e.g. "Anna kommenterade din tur ”Sydtoppen”". */
  text: string;
  /** Where tapping it leads, a path in the app. */
  url: string;
  createdAt: string;
  read: boolean;
}

/** Names, item titles and links for a set of notification rows, in the reader's language. */
async function describe(env: CommunityEnv, rows: Row[], lang: Lang = "sv"): Promise<NotificationView[]> {
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

  const en = lang === "en";
  return rows.map((r) => {
    const who = names.get(r.actorId) ?? (en ? "Someone" : "Någon");
    const title = r.itemType && r.itemId ? titles.get(`${r.itemType}:${r.itemId}`) : undefined;
    const quoted = title ? ` ”${title}”` : "";
    const thing = en
      ? r.itemType === "tour"
        ? `your tour${quoted}`
        : r.itemType === "route"
          ? `your route${quoted}`
          : "your observation"
      : r.itemType === "tour"
        ? `din tur${quoted}`
        : r.itemType === "route"
          ? `din rutt${quoted}`
          : "din observation";
    const where = en
      ? r.itemType === "tour"
        ? `the tour${quoted}`
        : r.itemType === "route"
          ? `the route${quoted}`
          : "an observation"
      : r.itemType === "tour"
        ? `turen${quoted}`
        : r.itemType === "route"
          ? `rutten${quoted}`
          : "en observation";
    const text =
      r.kind === "trip"
        ? (r.note ?? (en ? "The forecast for your planned tour is published." : "Prognosen för din planerade tur är publicerad."))
        : r.kind === "trip_invite"
          ? (r.note ?? (en ? `${who} invites you on a tour` : `${who} bjuder in dig till en tur`))
          : r.kind === "trip_join"
            ? (r.note ?? (en ? `${who} is joining your tour` : `${who} hänger med på din tur`))
        : r.kind === "moderation"
          ? (r.note ?? (en ? "Something you published was removed after a report." : "Något du publicerat har tagits bort efter en anmälan."))
          : r.kind === "follow"
            ? en
              ? `${who} started following you`
              : `${who} började följa dig`
            : r.kind === "comment"
              ? en
                ? `${who} commented on ${thing}`
                : `${who} kommenterade ${thing}`
              : r.kind === "reply"
                ? en
                  ? `${who} replied on ${where}`
                  : `${who} svarade på ${where}`
                : en
                  ? `${who} liked ${thing}`
                  : `${who} gillade ${thing}`;
    const url = r.url
      ? r.url
      : r.kind === "moderation"
        ? "/om-appen#villkor"
        : r.kind === "follow"
        ? `/person/${r.actorId}`
        : r.itemType === "tour"
          ? `/turer/${r.itemId}`
          : r.itemType === "route"
            ? `/karta?rutt=${r.itemId}`
            : "/flode";
    return {
      id: r.id,
      kind: r.kind,
      actor: SYSTEM_KINDS.has(r.kind) ? { id: r.actorId, displayName: "Snöläge" } : { id: r.actorId, displayName: who },
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
    `SELECT id, kind, actor_id AS actorId, item_type AS itemType, item_id AS itemId, note, url, created_at, read_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
  )
    .bind(me.id, MAX_LIST)
    .all<Row>();
  const notifications = await describe(env, rows.results, me.lang);
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
