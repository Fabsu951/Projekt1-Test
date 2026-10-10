import { currentUser, type CommunityEnv } from "./auth";
import { sendFcm, fcmConfigured, type FcmEnv, type NativeMessage } from "./fcm";
import { HttpError, nowIso, readJson } from "./http";
import { changeMessage, type DangerChange } from "./push";
import { clientIp, d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";
import { toLang } from "./lang";

// Push to the Android/iOS apps (the browser version uses web push, push.ts).
// A device registers its FCM token with the areas it wants danger-level
// notices for, and — only if the user turns it on while signed in — that
// it also wants the account's notices (follows, comments, likes).

export type NativeEnv = CommunityEnv & FcmEnv;

const TOKEN = /^[A-Za-z0-9_:\-]{100,4096}$/;
const REGISTER_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

interface RegisterBody {
  token?: unknown;
  platform?: unknown;
  regions?: unknown;
  account?: unknown;
  lang?: unknown;
}

/** Saves what this device wants; nothing wanted removes it. */
export async function registerDevice(request: Request, env: NativeEnv) {
  if (!fcmConfigured(env)) throw new HttpError(503, "Notiser i appen är inte aktiverade ännu.");
  const store = d1Store(env.DB);
  const key = `native-register:${clientIp(request)}`;
  await enforce(store, [{ key, ...REGISTER_LIMIT }], "För många ändringar av notiser. Försök igen senare.");

  const body = await readJson<RegisterBody>(request);
  const token = typeof body.token === "string" ? body.token : "";
  const platform = body.platform === "android" || body.platform === "ios" ? body.platform : null;
  if (!TOKEN.test(token) || !platform) throw new HttpError(400, "Ogiltig enhet för notiser.");
  const wanted = Array.isArray(body.regions) ? body.regions : [];
  const regions = REGION_SOURCES.map((r) => r.id).filter((id) => wanted.includes(id));
  // Account notices only for a signed-in user; otherwise silently off.
  const user = body.account === true ? await currentUser(request, env) : null;
  await record(store, [key]);

  if (regions.length === 0 && !user) {
    await env.DB.prepare("DELETE FROM native_devices WHERE token = ?").bind(token).run();
    return { regions, account: false };
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO native_devices (token, platform, regions, user_id, created_at, updated_at, lang) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (token) DO UPDATE SET platform = excluded.platform, regions = excluded.regions,
       user_id = excluded.user_id, updated_at = excluded.updated_at, lang = excluded.lang`
  )
    .bind(token, platform, JSON.stringify(regions), user?.id ?? null, now, now, toLang(body.lang))
    .run();
  return { regions, account: user !== null };
}

export async function unregisterDevice(request: Request, env: NativeEnv) {
  const body = await readJson<{ token?: unknown }>(request);
  if (typeof body.token === "string") await env.DB.prepare("DELETE FROM native_devices WHERE token = ?").bind(body.token).run();
  return { ok: true };
}

/** POST /native/lang {token, lang}: the phone's notices follow the app's language. */
export async function setDeviceLanguage(request: Request, env: NativeEnv) {
  const body = await readJson<{ token?: unknown; lang?: unknown }>(request);
  if (typeof body.token === "string") {
    await env.DB.prepare("UPDATE native_devices SET lang = ? WHERE token = ?").bind(toLang(body.lang), body.token).run();
  }
  return { ok: true };
}

async function forget(env: NativeEnv, tokens: string[]) {
  if (tokens.length) await env.DB.batch(tokens.map((t) => env.DB.prepare("DELETE FROM native_devices WHERE token = ?").bind(t)));
}

/** Danger-level changes to every device following the area. */
export async function notifyNativeChanges(env: NativeEnv, changes: DangerChange[], today: string, fetcher: typeof fetch = fetch) {
  if (changes.length === 0 || !fcmConfigured(env)) return;
  const { results } = await env.DB.prepare("SELECT token, regions, lang FROM native_devices WHERE regions != '[]'").all<{
    token: string;
    regions: string;
    lang: string;
  }>();
  const gone: string[] = [];
  for (const device of results) {
    let regions: unknown = [];
    try {
      regions = JSON.parse(device.regions);
    } catch {
      continue;
    }
    for (const change of changes) {
      if (!Array.isArray(regions) || !regions.includes(change.regionId)) continue;
      const msg = changeMessage(change, today, toLang(device.lang));
      if ((await sendFcm(env, device.token, msg, fetcher)) === "gone") {
        gone.push(device.token);
        break;
      }
    }
  }
  await forget(env, gone);
}

/** An account notice to every device where the user turned them on. */
export async function sendNativeToUser(env: NativeEnv, userId: number, msg: NativeMessage, fetcher: typeof fetch = fetch) {
  if (!fcmConfigured(env)) return;
  const { results } = await env.DB.prepare("SELECT token FROM native_devices WHERE user_id = ?").bind(userId).all<{ token: string }>();
  const gone: string[] = [];
  for (const d of results) if ((await sendFcm(env, d.token, msg, fetcher)) === "gone") gone.push(d.token);
  await forget(env, gone);
}
