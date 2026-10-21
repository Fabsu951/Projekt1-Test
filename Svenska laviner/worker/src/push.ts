import { HttpError, nowIso, readJson } from "./http";
import { clientIp, d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";
import { DANGER_NAMES, toLang, type Lang } from "./lang";
import { isPushEndpoint, vapidConfigured, type VapidEnv } from "./webpush";

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

const SUBSCRIBE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

export function publicKey(env: PushEnv) {
  return { publicKey: vapidConfigured(env) ? env.VAPID_PUBLIC_KEY : null };
}

interface SubscribeBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  regions?: unknown;
  lang?: unknown;
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
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, regions, created_at, updated_at, lang)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = excluded.p256dh, auth = excluded.auth, regions = excluded.regions, updated_at = excluded.updated_at,
       lang = excluded.lang`
  )
    .bind(endpoint, p256dh, auth, JSON.stringify(regions), now, now, toLang(body.lang))
    .run();
  return { regions };
}

export async function unsubscribe(request: Request, env: PushEnv) {
  const body = await readJson<{ endpoint?: string }>(request);
  if (body.endpoint) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
  return { ok: true };
}

/** POST /push/lang {endpoint, lang}: the browser's notices follow the app's language. */
export async function setPushLanguage(request: Request, env: PushEnv) {
  const body = await readJson<{ endpoint?: unknown; lang?: unknown }>(request);
  if (typeof body.endpoint === "string") {
    await env.DB.prepare("UPDATE push_subscriptions SET lang = ? WHERE endpoint = ?").bind(toLang(body.lang), body.endpoint).run();
  }
  return { ok: true };
}

/** The notification a browser shows for one change. */
export function changeMessage(change: DangerChange, today: string, lang: Lang = "sv") {
  const name = REGION_SOURCES.find((r) => r.id === change.regionId)?.name ?? change.regionId;
  const names = DANGER_NAMES[lang];
  const up = change.to > change.from;
  const tomorrow = change.date > today;
  return {
    title: lang === "en" ? `${name}: ${change.to} ${names[change.to]}` : `${name}: ${change.to} ${names[change.to]} fara`,
    body:
      lang === "en"
        ? `The danger level ${tomorrow ? "tomorrow" : "today"} has been ${up ? "raised" : "lowered"} from ${change.from} ${names[change.from]}.`
        : `Farograden ${tomorrow ? "i morgon" : "idag"} har ${up ? "höjts" : "sänkts"} från ${change.from} ${names[change.from]} fara.`,
    url: `/omrade/${change.regionId}`,
    tag: `danger-${change.regionId}`,
  };
}
