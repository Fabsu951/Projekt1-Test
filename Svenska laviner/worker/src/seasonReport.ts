import { mailAdmins, type AdminMailEnv } from "./adminMail";
import { DANGER_NAMES } from "./lang";
import { currentSeasonYear } from "./forecastApi";
import { stockholmDate } from "./model";
import { REGION_SOURCES } from "./regions";

// The first time in a season that any area has a published danger level,
// the admins get an email with everything Snöläge read for each area, to
// compare with lavinprognoser.se by eye. The parsing is tested against last
// season's pages and API answers; this is the check against the real thing
// when a new season starts (and Naturvårdsverket may have changed things).

/** What the report needs from an area's forecast as fetched. */
export interface ReportForecast {
  regionId: string;
  sourceUrl: string;
  source?: "api" | "page";
  fetchError: string | null;
  danger: number | null;
  seasonOver: boolean;
  notAssessed: boolean;
  special?: string | null;
  riskLabel?: string | null;
  headline: string | null;
  validUntil: string | null;
  problems: Array<{ name: string; aspects: string[]; elevations: string[]; metersAbove: number | null; metersBelow: number | null; size?: string | null }>;
  trend?: { date: string; danger: number | null; label: string | null } | null;
}

const regionName = (id: string) => REGION_SOURCES.find((r) => r.id === id)?.name ?? id;
const ELEVATIONS: Record<string, string> = { kalfjall: "kalfjäll", tradgrans: "trädgräns", under_tradgrans: "under trädgräns" };

function status(f: ReportForecast): string {
  if (f.fetchError) return `kunde inte hämtas (${f.fetchError})`;
  if (f.danger !== null) return `${f.danger} ${DANGER_NAMES.sv[f.danger]}`;
  if (f.special) return f.riskLabel ?? f.special;
  if (f.notAssessed) return "Ej bedömd";
  if (f.seasonOver) return "Utanför säsong";
  return "Ingen prognos";
}

/** The email's lines, one block per area. */
export function seasonReportLines(forecasts: ReportForecast[]): string[] {
  const lines: string[] = [];
  for (const f of forecasts) {
    lines.push(`${regionName(f.regionId)}: ${status(f)}${f.source ? ` (från ${f.source === "api" ? "API:et" : "sidan"})` : ""}`);
    if (f.validUntil) lines.push(`  Gäller till: ${f.validUntil.slice(0, 16).replace("T", " ")} UTC`);
    if (f.headline) lines.push(`  Rubrik: ${f.headline}`);
    for (const p of f.problems) {
      const heights = [
        p.elevations.map((e) => ELEVATIONS[e] ?? e).join(", "),
        p.metersAbove !== null ? `över ${p.metersAbove} m` : "",
        p.metersBelow !== null ? `under ${p.metersBelow} m` : "",
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`  Lavinproblem: ${p.name} – ${p.aspects.join(", ") || "alla väderstreck"}; ${heights || "alla höjder"}${p.size ? `; ${p.size}` : ""}`);
    }
    if (f.trend) lines.push(`  Utveckling ${f.trend.date}: ${f.trend.danger !== null ? `${f.trend.danger} ${DANGER_NAMES.sv[f.trend.danger]}` : (f.trend.label ?? "–")}`);
    lines.push(`  Jämför med: ${f.sourceUrl}`);
  }
  return lines;
}

/** Sends the report once per season, the first time any area has a level. */
export async function seasonStartReport(env: AdminMailEnv, forecasts: ReportForecast[], now = new Date()): Promise<boolean> {
  if (!forecasts.some((f) => f.danger !== null && f.danger >= 1 && f.danger <= 5)) return false;
  const name = `season-report-${currentSeasonYear(now)}`;
  // Claimed before sending, so two fetches at once can't both send it.
  const claimed = await env.DB.prepare(
    "INSERT INTO service_alerts (name, problems, first_seen, last_sent) VALUES (?, '[]', ?, ?) ON CONFLICT (name) DO NOTHING"
  )
    .bind(name, now.toISOString(), now.toISOString())
    .run();
  if (claimed.meta.changes === 0) return false;
  await mailAdmins(
    env,
    `Snöläge: säsongens första prognoser (${stockholmDate(now)})`,
    [
      "Naturvårdsverket har publicerat säsongens första farograder. Så här läste Snöläge dem – jämför med lavinprognoser.se för varje område:",
      "",
      ...seasonReportLines(forecasts),
      "",
      "Stämmer något inte (farograd, lavinproblem, väderstreck, höjder eller utveckling), starta en session med Claude och beskriv skillnaden. Appen visar aldrig en farograd som inte är publicerad.",
    ],
    { footer: ["Allt som hämtades: https://fjallkoll-worker.fabian-n-sund.workers.dev/forecasts"] }
  );
  return true;
}
