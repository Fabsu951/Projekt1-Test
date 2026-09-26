import { useContext } from "react";
import { FavoritesContext, type FavoritesState } from "./favoritesContext";

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return ctx;
}
