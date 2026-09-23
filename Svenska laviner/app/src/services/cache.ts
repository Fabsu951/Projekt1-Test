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
