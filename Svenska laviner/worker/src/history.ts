import { stockholmDate } from "./model";
import type { DangerChange } from "./push";
import type { ParsedForecast } from "./parse";

export interface HistoryRow {
  regionId: string;
  /** YYYY-MM-DD, Swedish time: the day the forecast is valid until. */
  date: string;
  danger: number;
  /** lavinprognoser.se problem slugs, in the forecast's order. */
  problems: string[];
}

export interface HistoryDay {
  date: string;
  /** Null when no published forecast was recorded for that day. */
  danger: number | null;
  problems: string[];
}

/** The row to record for a parsed forecast, or null when it has no level to record. */
export function historyRow(regionId: string, forecast: ParsedForecast): HistoryRow | null {
  if (forecast.danger === null || forecast.validUntil === null) return null;
  return {
    regionId,
    date: stockholmDate(new Date(forecast.validUntil)),
    danger: forecast.danger,
    problems: forecast.problems.map((p) => p.type),
  };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The last `days` days up to today, one entry per day with gaps as null.
 * After the 18:00 publication the newest forecast is already tomorrow's;
 * the window then ends tomorrow instead, so it's never left out.
 */
export function historyWindow(rows: HistoryRow[], today: string, days: number): HistoryDay[] {
  const tomorrow = addDays(today, 1);
  const end = rows.some((r) => r.date === tomorrow) ? tomorrow : today;
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(end, i - days + 1);
    const row = byDate.get(date);
    return { date, danger: row?.danger ?? null, problems: row?.problems ?? [] };
  });
}

export async function recordHistory(db: D1Database, rows: HistoryRow[], now: Date): Promise<void> {
  if (rows.length === 0) return;
  const recordedAt = now.toISOString();
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `INSERT INTO forecast_history (region_id, date, danger, problems, recorded_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (region_id, date) DO UPDATE SET
             danger = excluded.danger, problems = excluded.problems, recorded_at = excluded.recorded_at`
        )
        .bind(r.regionId, r.date, r.danger, JSON.stringify(r.problems), recordedAt)
    )
  );
}

export async function readHistory(db: D1Database, regionId: string, now: Date, days: number): Promise<HistoryDay[]> {
  const today = stockholmDate(now);
  const { results } = await db
    .prepare("SELECT date, danger, problems FROM forecast_history WHERE region_id = ? AND date BETWEEN ? AND ?")
    .bind(regionId, addDays(today, -days), addDays(today, 1))
    .all<{ date: string; danger: number; problems: string }>();

  const rows: HistoryRow[] = results.map((r) => {
    let problems: string[] = [];
    try {
      const parsed = JSON.parse(r.problems);
      if (Array.isArray(parsed)) problems = parsed.filter((p): p is string => typeof p === "string");
    } catch {
      // A malformed row still has a usable danger level.
    }
    return { regionId, date: r.date, danger: r.danger, problems };
  });
  return historyWindow(rows, today, days);
}

/** Older than this, a previous level belongs to an earlier spell (e.g. last season). */
const CHANGE_LOOKBACK_DAYS = 3;

/**
 * Whether a newly fetched row changes the level compared with the latest
 * one recorded before it (the same day's, if the forecast was updated).
 */
export function changeFrom(row: HistoryRow, previous: { date: string; danger: number } | null): DangerChange | null {
  if (!previous || previous.danger === row.danger) return null;
  if (previous.date < addDays(row.date, -CHANGE_LOOKBACK_DAYS)) return null;
  return { regionId: row.regionId, date: row.date, from: previous.danger, to: row.danger };
}

/** Compares rows with what is stored; call before recordHistory overwrites them. */
export async function findChanges(db: D1Database, rows: HistoryRow[]): Promise<DangerChange[]> {
  const changes: DangerChange[] = [];
  for (const row of rows) {
    const previous = await db
      .prepare(
        "SELECT date, danger FROM forecast_history WHERE region_id = ? AND date <= ? ORDER BY date DESC LIMIT 1"
      )
      .bind(row.regionId, row.date)
      .first<{ date: string; danger: number }>();
    const change = changeFrom(row, previous ?? null);
    if (change) changes.push(change);
  }
  return changes;
}
