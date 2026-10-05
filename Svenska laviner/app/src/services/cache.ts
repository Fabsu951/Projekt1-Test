import { Preferences } from "@capacitor/preferences";

interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

export interface CachedResult<T> {
  data: T;
  cachedAt: string | null;
  stale: boolean;
}

const PREFIX = "fjallkoll:cache:";

async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const { value } = await Preferences.get({ key: PREFIX + key });
    if (!value) return null;
    return JSON.parse(value) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { data, cachedAt: new Date().toISOString() };
  try {
    await Preferences.set({ key: PREFIX + key, value: JSON.stringify(envelope) });
  } catch {
    // Best-effort — storage may be unavailable (e.g. private browsing). Not fatal.
  }
}

/**
 * Fetches fresh data and caches it. If the fetch fails, falls back to the
 * last cached value (marked stale) so the app stays usable with spotty or no
 * signal in the mountains. Rethrows the original error only if there is
 * nothing cached to fall back to.
 */
export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<CachedResult<T>> {
  try {
    const data = await fetcher();
    await writeCache(key, data);
    return { data, cachedAt: new Date().toISOString(), stale: false };
  } catch (err) {
    const cached = await readCache<T>(key);
    if (cached) {
      return { data: cached.data, cachedAt: cached.cachedAt, stale: true };
    }
    throw err;
  }
}

/** Fired when a screen shows saved data because the network failed; detail = { cachedAt }. */
export const SHOWING_SAVED_EVENT = "fjallkoll:showing-saved";

/** Data tied to the signed-in account is kept under this prefix, and cleared on logout. */
export const USER_SCOPE = "user:";

/** Saved answers bigger than this aren't kept (long GPS tracks), to leave room for the rest. */
const MAX_SAVED_CHARS = 400_000;

/**
 * Like withCache, for any GET from the worker: returns fresh data and saves
 * it, or — when the network fails — the last saved answer. Server answers
 * like "not found" are passed on, never covered up with old data.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    const json = JSON.stringify({ data, cachedAt: new Date().toISOString() });
    if (json.length <= MAX_SAVED_CHARS) {
      try {
        await Preferences.set({ key: PREFIX + key, value: json });
      } catch {
        // Storage full or unavailable: the app still works online.
      }
    }
    return data;
  } catch (err) {
    const status = (err as { status?: unknown })?.status;
    if (typeof status === "number" && status >= 400) throw err;
    const saved = await readCache<T>(key);
    if (!saved) throw err;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SHOWING_SAVED_EVENT, { detail: { cachedAt: saved.cachedAt } }));
    }
    return saved.data;
  }
}

/** When something was last saved under this key, or null. */
export async function savedAt(key: string): Promise<string | null> {
  return (await readCache(key))?.cachedAt ?? null;
}

/** Forgets everything saved for the signed-in account (logout, account deletion). */
export async function clearUserCache(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX + USER_SCOPE)).map((key) => Preferences.remove({ key })));
  } catch {
    // Nothing to clear.
  }
}
