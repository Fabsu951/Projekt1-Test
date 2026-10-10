import type { HistoryDay } from "../services/avalancheService";
import type { DangerLevel, ForecastProblem } from "../types/avalanche";
import { COMPASS_SECTORS } from "./windAnalysis";
import { ELEVATION_LABELS } from "../data/elevations";
import { t, compass } from "../i18n";

/** YYYY-MM-DD in Swedish time, `offsetDays` from `now`. */
export function swedishDate(now: Date, offsetDays = 0): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

/** The last `count` recorded days up to and including today (tomorrow's forecast left out). */
export function recentDays(history: HistoryDay[], now: Date, count = 7): HistoryDay[] {
  const today = swedishDate(now);
  return history.filter((d) => d.date <= today).slice(-count);
}

export type Trend = { kind: "up" | "down" | "same"; from: DangerLevel } | null;

/** How today's level compares with yesterday's recorded one; null when either is missing. */
export function trendSinceYesterday(history: HistoryDay[], today: DangerLevel | null, now: Date): Trend {
  if (today === null) return null;
  const yesterday = history.find((d) => d.date === swedishDate(now, -1))?.dangerLevel ?? null;
  if (yesterday === null) return null;
  return { kind: today > yesterday ? "up" : today < yesterday ? "down" : "same", from: yesterday };
}

/** "Drevsnöflak · O–S · kalfjäll"-style summary of where a problem is found. */
export function problemWhere(p: ForecastProblem): string {
  const parts: string[] = [];
  if (p.aspects.length > 0) {
    parts.push(p.aspects.length === COMPASS_SECTORS.length ? t("alla väderstreck") : orderedAspects(p.aspects).map(compass).join(", "));
  }
  if (p.metersAbove !== null) parts.push(t("över {m} m", { m: p.metersAbove }));
  else if (p.metersBelow !== null) parts.push(t("under {m} m", { m: p.metersBelow }));
  else if (p.elevations.length > 0 && p.elevations.length < 3) parts.push(p.elevations.map((e) => ELEVATION_LABELS[e].toLowerCase()).join(", "));
  return parts.join(" · ");
}

function orderedAspects(aspects: ForecastProblem["aspects"]) {
  return COMPASS_SECTORS.filter((s) => aspects.includes(s));
}
