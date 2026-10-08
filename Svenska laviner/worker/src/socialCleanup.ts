import type { CommunityEnv } from "./auth";

export type ItemType = "tour" | "observation" | "route";

/** Statements removing an item's comments, likes and reports, to run with its deletion. */
export function socialCleanup(env: Pick<CommunityEnv, "DB">, type: ItemType, id: number): D1PreparedStatement[] {
  return [
    // Reports on the item's comments first, while the comments still exist.
    env.DB.prepare(
      "DELETE FROM content_reports WHERE item_type = 'comment' AND item_id IN (SELECT id FROM comments WHERE item_type = ? AND item_id = ?)"
    ).bind(type, id),
    env.DB.prepare("DELETE FROM content_reports WHERE item_type = ? AND item_id = ?").bind(type, id),
    env.DB.prepare("DELETE FROM comments WHERE item_type = ? AND item_id = ?").bind(type, id),
    env.DB.prepare("DELETE FROM likes WHERE item_type = ? AND item_id = ?").bind(type, id),
    env.DB.prepare("DELETE FROM notifications WHERE item_type = ? AND item_id = ?").bind(type, id),
  ];
}
