import { requireUser, type CommunityEnv } from "./auth";
import { readJson } from "./http";
import { REGION_SOURCES } from "./regions";

/** Known region ids only, each once, in the given order. */
export function cleanFavorites(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(REGION_SOURCES.map((r) => r.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

function parseStored(json: string | null): string[] {
  try {
    return cleanFavorites(JSON.parse(json ?? "[]"));
  } catch {
    return [];
  }
}

export async function getFavorites(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare("SELECT favorites FROM users WHERE id = ?").bind(user.id).first<{ favorites: string }>();
  return { favorites: parseStored(row?.favorites ?? null) };
}

/** Replaces the user's favourites with the given list (the app sends its whole list). */
export async function saveFavorites(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const body = await readJson<{ favorites?: unknown }>(request);
  const favorites = cleanFavorites(body.favorites);
  await env.DB.prepare("UPDATE users SET favorites = ? WHERE id = ?").bind(JSON.stringify(favorites), user.id).run();
  return { favorites };
}
