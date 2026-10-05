import type { CommunityEnv } from "./auth";

export type ItemType = "tour" | "observation" | "route";

/** Statements removing an item's comments and likes, to run with its deletion. */
export function socialCleanup(env: Pick<CommunityEnv, "DB">, type: ItemType, id: number): D1PreparedStatement[] {
  return [
    env.DB.prepare("DELETE FROM comments WHERE item_type = ? AND item_id = ?").bind(type, id),
    env.DB.prepare("DELETE FROM likes WHERE item_type = ? AND item_id = ?").bind(type, id),
    env.DB.prepare("DELETE FROM notifications WHERE item_type = ? AND item_id = ?").bind(type, id),
  ];
}
