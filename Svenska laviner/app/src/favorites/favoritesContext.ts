import { createContext } from "react";

export interface FavoritesState {
  /** Region ids, in the order they were starred. */
  favorites: string[];
  /** The device's saved list has been read (until then `favorites` may be empty). */
  loaded?: boolean;
  isFavorite: (regionId: string) => boolean;
  toggleFavorite: (regionId: string) => void;
}

export const FavoritesContext = createContext<FavoritesState | null>(null);
