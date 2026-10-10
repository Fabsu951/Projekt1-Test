import { api } from "./api";

export interface AdminStats {
  totals: {
    users: number;
    verifiedUsers: number;
    activeLastWeek: number;
    observations: number;
    hiddenObservations: number;
    tours: number;
    sharedTours: number;
    routes: number;
    comments: number;
    follows: number;
    tripPlans: number;
    webPush: number;
    appDevices: number;
    openReports: number;
  };
  weeks: Array<{ week: string; users: number; observations: number; tours: number }>;
  regions: Array<{ regionId: string; name: string; favorites: number; observations: number; tours: number }>;
  /** The server's check of the forecast fetching (worker/src/health.ts); problems are in Swedish. */
  forecastHealth?: { problems: string[]; since: string | null };
  /** The weekly database copy in R2 (worker/src/backup.ts). */
  backup?: { latestAt: string | null; bytes: number | null; count: number } | null;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  return api<AdminStats>("/admin/stats", { token });
}
