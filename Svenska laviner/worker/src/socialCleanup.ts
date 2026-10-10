import type { CommunityEnv } from "./auth";

export type ItemType = "tour" | "observation" | "route";

/** Statements removing an item's comments, likes and reports (and a route's use on tour days), to run with its deletion. */
export function socialCleanup(env: Pick<CommunityEnv, "DB">, type: ItemType, id: number): D1PreparedStatement[] {
  const routeUses =
    type === "route"
      ? [env.DB.prepare("UPDATE trip_plans SET route_id = NULL, route_title = NULL, route_steep = NULL WHERE route_id = ?").bind(id)]
      : [];
  return [
    ...routeUses,
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
