import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { REGIONS } from "../data/regions";
import { FavoritesContext, type FavoritesState } from "./favoritesContext";

const FAVORITES_KEY = "fjallkoll:favorites";

/** Only ids of regions that still exist, without duplicates. */
function clean(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(REGIONS.map((r) => r.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

/**
 * Starred regions, kept on the device (Capacitor Preferences, i.e.
 * localStorage on the web) so they work without an account and offline.
 */
export default function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: FAVORITES_KEY })
      .then(({ value }) => {
        if (!cancelled && value) setFavorites(clean(JSON.parse(value)));
      })
      .catch(() => {
        // Storage unavailable or corrupt — start with no favorites.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = useCallback((regionId: string) => {
    setFavorites((current) => {
      const next = current.includes(regionId) ? current.filter((id) => id !== regionId) : clean([...current, regionId]);
      Preferences.set({ key: FAVORITES_KEY, value: JSON.stringify(next) }).catch(() => {
        // Best-effort: the star still works for this visit.
      });
      return next;
    });
  }, []);

  const value = useMemo<FavoritesState>(
    () => ({ favorites, isFavorite: (id) => favorites.includes(id), toggleFavorite }),
    [favorites, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
