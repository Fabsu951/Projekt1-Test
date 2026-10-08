import { api } from "./api";

// Reports on tours, shared routes, comments and profiles (observations have
// their own, older report endpoint in observationService.ts).

export type ReportType = "tour" | "route" | "comment" | "profile";

export async function reportContent(token: string, type: ReportType, id: number, reason: string): Promise<void> {
  await api("/reports", { method: "POST", token, json: { type, id, reason } });
}

export interface ReportedItem {
  type: ReportType;
  id: number;
  reports: number;
  latestAt: string;
  reasons: string[];
  owner: { id: number; displayName: string };
  summary: string;
  url: string;
  hidden: boolean;
}

export async function fetchContentReports(token: string): Promise<{ items: ReportedItem[]; reasons: Record<string, string> }> {
  return api("/admin/content-reports", { token });
}

export async function dismissContentReports(token: string, type: ReportType, id: number): Promise<void> {
  await api("/admin/content-reports/dismiss", { method: "POST", token, json: { type, id } });
}

export async function removeReportedContent(
  token: string,
  type: ReportType,
  id: number,
  reason: string,
  note: string
): Promise<void> {
  await api("/admin/content-reports/remove", { method: "POST", token, json: { type, id, reason, note } });
}
