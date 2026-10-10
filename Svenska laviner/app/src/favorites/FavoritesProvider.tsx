import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { AuthContext } from "../auth/authContext";
import { REGIONS } from "../data/regions";
import { api } from "../services/api";
import { FavoritesContext, type FavoritesState } from "./favoritesContext";

const FAVORITES_KEY = "fjallkoll:favorites";

/** Only ids of regions that still exist, without duplicates. */
function clean(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(REGIONS.map((r) => r.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

function saveLocal(ids: string[]) {
  Preferences.set({ key: FAVORITES_KEY, value: JSON.stringify(ids) }).catch(() => {
    // Best-effort: the star still works for this visit.
  });
}

function saveToAccount(token: string, ids: string[]) {
  api("/auth/favorites", { method: "POST", token, json: { favorites: ids } }).catch(() => {
    // Kept on this device either way; the next change or login syncs again.
  });
}

/**
 * Starred regions. Always kept on the device (Capacitor Preferences, i.e.
 * localStorage on the web) so they work without an account and offline.
 * When signed in they are also saved to the account, and on login the
 * account's and this device's favourites are merged, so they follow the
 * user between devices.
 */
export default function FavoritesProvider({ children }: { children: ReactNode }) {
  // Read directly so the provider also works without an AuthProvider (tests).
  const token = useContext(AuthContext)?.token ?? null;
  const [favorites, setFavorites] = useState<string[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const current = useRef<string[]>([]);
  const tokenRef = useRef<string | null>(null);

  const apply = useCallback((ids: string[]) => {
    current.current = ids;
    setFavorites(ids);
    saveLocal(ids);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: FAVORITES_KEY })
      .then(({ value }) => {
        if (cancelled || !value) return;
        current.current = clean(JSON.parse(value));
        setFavorites(current.current);
      })
      .catch(() => {
        // Storage unavailable or corrupt — start with no favorites.
      })
      .finally(() => {
        if (!cancelled) setLocalLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // On login (or app start while logged in): merge account + device favourites.
  useEffect(() => {
    tokenRef.current = token;
    if (!token || !localLoaded) return;
    let cancelled = false;
    api<{ favorites: string[] }>("/auth/favorites", { token })
      .then(({ favorites: fromAccount }) => {
        if (cancelled) return;
        const account = clean(fromAccount);
        const merged = clean([...account, ...current.current]);
        apply(merged);
        if (merged.length !== account.length) saveToAccount(token, merged);
      })
      .catch(() => {
        // Offline or an older server: keep using this device's favourites.
      });
    return () => {
      cancelled = true;
    };
  }, [token, localLoaded, apply]);

  const toggleFavorite = useCallback(
    (regionId: string) => {
      const prev = current.current;
      const next = prev.includes(regionId) ? prev.filter((id) => id !== regionId) : clean([...prev, regionId]);
      apply(next);
      if (tokenRef.current) saveToAccount(tokenRef.current, next);
    },
    [apply]
  );

  const value = useMemo<FavoritesState>(
    () => ({ favorites, loaded: localLoaded, isFavorite: (id) => favorites.includes(id), toggleFavorite }),
    [favorites, localLoaded, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
