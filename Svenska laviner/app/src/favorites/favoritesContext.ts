import { createContext } from "react";

export interface FavoritesState {
  /** Region ids, in the order they were starred. */
  favorites: string[];
  isFavorite: (regionId: string) => boolean;
  toggleFavorite: (regionId: string) => void;
}

export const FavoritesContext = createContext<FavoritesState | null>(null);
