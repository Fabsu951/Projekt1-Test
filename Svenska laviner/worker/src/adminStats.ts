import { forecastHealth } from "./health";
import { backupStatus } from "./backup";
import { requireUser, type CommunityEnv } from "./auth";
import { HttpError } from "./http";
import { addDays } from "./history";
import { stockholmDate } from "./model";
import { REGION_SOURCES } from "./regions";

// GET /admin/stats: an overview for the admin (Fabian) — how many people use
// Snöläge and what they do. Counts only, no names or content.

const WEEKS = 12;

export interface WeekStats {
  /** Monday of the week, YYYY-MM-DD (Swedish date). */
  week: string;
  users: number;
  observations: number;
  tours: number;
}

/** Monday of the week a Swedish date falls in. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

/** The last WEEKS weeks (oldest first) with how many of each were created in them. */
export function weekly(rows: Record<"users" | "observations" | "tours", string[]>, now: Date): WeekStats[] {
  const thisWeek = mondayOf(stockholmDate(now));
  const weeks: WeekStats[] = Array.from({ length: WEEKS }, (_, i) => ({
    week: addDays(thisWeek, (i - WEEKS + 1) * 7),
    users: 0,
    observations: 0,
    tours: 0,
  }));
  const index = new Map(weeks.map((w, i) => [w.week, i]));
  for (const kind of ["users", "observations", "tours"] as const) {
    for (const createdAt of rows[kind]) {
      const i = index.get(mondayOf(stockholmDate(new Date(createdAt))));
      if (i !== undefined) weeks[i][kind]++;
    }
  }
  return weeks;
}

async function count(env: CommunityEnv, sql: string, ...binds: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql).bind(...binds).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function adminStats(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  if (!me.isAdmin) throw new HttpError(403, "Endast för administratörer.");

  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();
  const since = new Date(now.getTime() - (WEEKS * 7 + 7) * 864e5).toISOString();
  const totals = {
    users: await count(env, "SELECT COUNT(*) AS n FROM users"),
    verifiedUsers: await count(env, "SELECT COUNT(*) AS n FROM users WHERE email_verified = 1"),
    activeLastWeek: await count(env, "SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE created_at > ?", weekAgo),
    observations: await count(env, "SELECT COUNT(*) AS n FROM observations"),
    hiddenObservations: await count(env, "SELECT COUNT(*) AS n FROM observations WHERE hidden = 1"),
    tours: await count(env, "SELECT COUNT(*) AS n FROM tours"),
    sharedTours: await count(env, "SELECT COUNT(*) AS n FROM tours WHERE shared = 1"),
    routes: await count(env, "SELECT COUNT(*) AS n FROM routes"),
    comments: await count(env, "SELECT COUNT(*) AS n FROM comments"),
    follows: await count(env, "SELECT COUNT(*) AS n FROM follows"),
    tripPlans: await count(env, "SELECT COUNT(*) AS n FROM trip_plans WHERE date >= ?", stockholmDate(now)),
    webPush: await count(env, "SELECT COUNT(*) AS n FROM push_subscriptions"),
    appDevices: await count(env, "SELECT COUNT(*) AS n FROM native_devices"),
    openReports:
      (await count(env, "SELECT COUNT(*) AS n FROM reports")) +
      (await count(env, "SELECT COUNT(*) AS n FROM content_reports")),
  };

  const created = async (table: string) =>
    (await env.DB.prepare(`SELECT created_at FROM ${table} WHERE created_at > ?`).bind(since).all<{ created_at: string }>()).results.map(
      (r) => r.created_at
    );
  const weeks = weekly({ users: await created("users"), observations: await created("observations"), tours: await created("tours") }, now);

  const perRegion = async (table: string) => {
    const rows = await env.DB.prepare(`SELECT region_id, COUNT(*) AS n FROM ${table} WHERE region_id IS NOT NULL GROUP BY region_id`).all<{
      region_id: string;
      n: number;
    }>();
    return new Map(rows.results.map((r) => [r.region_id, r.n]));
  };
  const observationsBy = await perRegion("observations");
  const toursBy = await perRegion("tours");
  const favoritesBy = new Map<string, number>();
  const favs = await env.DB.prepare("SELECT favorites FROM users WHERE favorites IS NOT NULL AND favorites != '[]'").all<{ favorites: string }>();
  for (const r of favs.results) {
    try {
      for (const id of JSON.parse(r.favorites) as unknown[]) if (typeof id === "string") favoritesBy.set(id, (favoritesBy.get(id) ?? 0) + 1);
    } catch {
      // Not a list: skip.
    }
  }
  const regions = REGION_SOURCES.map((r) => ({
    regionId: r.id,
    name: r.name,
    favorites: favoritesBy.get(r.id) ?? 0,
    observations: observationsBy.get(r.id) ?? 0,
    tours: toursBy.get(r.id) ?? 0,
  }));

  return {
    totals,
    weeks,
    regions,
    forecastHealth: await forecastHealth(env.DB),
    backup: await backupStatus(env).catch(() => null),
  };
}
