import { HttpError } from "./http";

/** Where rate-limit events live; D1 in production, a plain array in tests. */
export interface RateLimitStore {
  count(key: string, sinceIso: string): Promise<number>;
  add(key: string, atIso: string): Promise<void>;
  clear(key: string): Promise<void>;
  pruneBefore(iso: string): Promise<void>;
}

export interface Limit {
  /** Plain key, e.g. "login-email:a@b.se"; hashed before it is stored. */
  key: string;
  max: number;
  windowMs: number;
}

const KEEP_MS = 24 * 3600 * 1000;

export const LOGIN_EMAIL_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
// Per IP address the limits are generous: a school wifi or a mobile operator
// can put hundreds of people behind one address. Password guessing is held
// back per account above, and bots at signup by Turnstile.
export const LOGIN_IP_LIMIT = { max: 100, windowMs: 15 * 60 * 1000 };
export const REGISTER_IP_LIMIT = { max: 100, windowMs: 60 * 60 * 1000 };

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fjallkoll-rate:${key}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Throws 429 with `message` if any of the limits is already used up. */
export async function enforce(store: RateLimitStore, limits: Limit[], message: string, now = new Date()): Promise<void> {
  await store.pruneBefore(new Date(now.getTime() - KEEP_MS).toISOString());
  for (const limit of limits) {
    const since = new Date(now.getTime() - limit.windowMs).toISOString();
    if ((await store.count(await hashKey(limit.key), since)) >= limit.max) {
      throw new HttpError(429, message);
    }
  }
}

export async function record(store: RateLimitStore, keys: string[], now = new Date()): Promise<void> {
  for (const key of keys) await store.add(await hashKey(key), now.toISOString());
}

export async function clear(store: RateLimitStore, key: string): Promise<void> {
  await store.clear(await hashKey(key));
}

export function d1Store(db: D1Database): RateLimitStore {
  return {
    async count(key, since) {
      const row = await db
        .prepare("SELECT COUNT(*) AS n FROM rate_limit_events WHERE key = ? AND at > ?")
        .bind(key, since)
        .first<{ n: number }>();
      return row?.n ?? 0;
    },
    async add(key, at) {
      await db.prepare("INSERT INTO rate_limit_events (key, at) VALUES (?, ?)").bind(key, at).run();
    },
    async clear(key) {
      await db.prepare("DELETE FROM rate_limit_events WHERE key = ?").bind(key).run();
    },
    async pruneBefore(iso) {
      await db.prepare("DELETE FROM rate_limit_events WHERE at < ?").bind(iso).run();
    },
  };
}

/** The caller's IP as Cloudflare reports it; "unknown" in local dev. */
export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}
