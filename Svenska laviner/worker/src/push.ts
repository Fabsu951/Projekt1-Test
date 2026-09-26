import { HttpError, nowIso, readJson } from "./http";
import { clientIp, d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";
import { isPushEndpoint, sendPush, vapidConfigured, type PushSubscriptionKeys, type VapidEnv } from "./webpush";

export interface PushEnv extends VapidEnv {
  DB: D1Database;
}

export interface DangerChange {
  regionId: string;
  /** YYYY-MM-DD the new forecast is valid until. */
  date: string;
  from: number;
  to: number;
}

const DANGER_LABELS: Record<number, string> = {
  1: "Liten fara",
  2: "Måttlig fara",
  3: "Betydande fara",
  4: "Stor fara",
  5: "Mycket stor fara",
};

const SUBSCRIBE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

export function publicKey(env: PushEnv) {
  return { publicKey: vapidConfigured(env) ? env.VAPID_PUBLIC_KEY : null };
}

interface SubscribeBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  regions?: unknown;
}

/** Saves (or updates) a browser's subscription; an empty region list removes it. */
export async function subscribe(request: Request, env: PushEnv) {
  if (!vapidConfigured(env)) throw new HttpError(503, "Notiser är inte aktiverade ännu.");
  const store = d1Store(env.DB);
  const key = `push-subscribe:${clientIp(request)}`;
  await enforce(store, [{ key, ...SUBSCRIBE_LIMIT }], "För många ändringar av notiser. Försök igen senare.");

  const body = await readJson<SubscribeBody>(request);
  const endpoint = body.subscription?.endpoint ?? "";
  const p256dh = body.subscription?.keys?.p256dh ?? "";
  const auth = body.subscription?.keys?.auth ?? "";
  if (!isPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) {
    throw new HttpError(400, "Ogiltig prenumeration på notiser.");
  }
  const wanted = Array.isArray(body.regions) ? body.regions : [];
  const regions = REGION_SOURCES.map((r) => r.id).filter((id) => wanted.includes(id));
  await record(store, [key]);

  if (regions.length === 0) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
    return { regions };
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, regions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = excluded.p256dh, auth = excluded.auth, regions = excluded.regions, updated_at = excluded.updated_at`
  )
    .bind(endpoint, p256dh, auth, JSON.stringify(regions), now, now)
    .run();
  return { regions };
}

export async function unsubscribe(request: Request, env: PushEnv) {
  const body = await readJson<{ endpoint?: string }>(request);
  if (body.endpoint) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
  return { ok: true };
}

/** The notification a browser shows for one change. */
export function changeMessage(change: DangerChange, today: string) {
  const name = REGION_SOURCES.find((r) => r.id === change.regionId)?.name ?? change.regionId;
  const when = change.date > today ? "i morgon" : "idag";
  const direction = change.to > change.from ? "höjts" : "sänkts";
  return {
    title: `${name}: ${change.to} ${DANGER_LABELS[change.to]}`,
    body: `Farograden ${when} har ${direction} från ${change.from} ${DANGER_LABELS[change.from]}.`,
    url: `/omrade/${change.regionId}`,
    tag: `danger-${change.regionId}`,
  };
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  regions: string;
}

/** Notifies every subscriber of each changed region, and drops dead subscriptions. */
export async function notifyChanges(
  env: PushEnv,
  changes: DangerChange[],
  today: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  if (changes.length === 0 || !vapidConfigured(env)) return;
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth, regions FROM push_subscriptions").all<SubscriptionRow>();

  const gone: string[] = [];
  for (const sub of results) {
    let regions: unknown = [];
    try {
      regions = JSON.parse(sub.regions);
    } catch {
      continue;
    }
    for (const change of changes) {
      if (!Array.isArray(regions) || !regions.includes(change.regionId)) continue;
      const keys: PushSubscriptionKeys = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
      const result = await sendPush(env, keys, changeMessage(change, today), fetcher);
      if (result === "gone") {
        gone.push(sub.endpoint);
        break;
      }
    }
  }
  if (gone.length > 0) {
    await env.DB.batch(gone.map((e) => env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(e)));
  }
}
