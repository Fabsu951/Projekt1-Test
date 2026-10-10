import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { addDays } from "./history";
import { stockholmDate } from "./model";
import { notify, type Defer, type NotifyEnv } from "./notifications";
import { REGION_SOURCES } from "./regions";

// "Prognos inför turen": a user plans a day in an area; when the forecast
// for that day is published (normally 18:00 the evening before) they get it
// as a notification with the level and the avalanche problems. If no level
// has been published by the morning of the day, they are told that instead.
// Only published levels are ever sent, never a guess.

/** How far ahead a tour can be planned. */
export const MAX_DAYS_AHEAD = 14;
const MAX_UPCOMING = 20;
/** Past plans are kept a week, then removed. */
const KEEP_PAST_DAYS = 7;
/** From this Swedish hour on the tour day, "no level published" is sent. */
const MORNING_HOUR = 7;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DANGER_LABELS: Record<number, string> = {
  1: "Liten",
  2: "Måttlig",
  3: "Betydande",
  4: "Stor",
  5: "Mycket stor",
};
const WEEKDAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const MONTHS = ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];

/** "lördag 14 feb" */
export function swedishDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]}`;
}

const regionName = (id: string) => REGION_SOURCES.find((r) => r.id === id)?.name ?? id;

export interface TripPlan {
  id: number;
  regionId: string;
  date: string;
  notified: boolean;
}

interface TripRow {
  id: number;
  user_id: number;
  region_id: string;
  date: string;
  notified_at: string | null;
}

const toPlan = (r: TripRow): TripPlan => ({ id: r.id, regionId: r.region_id, date: r.date, notified: r.notified_at !== null });

/** GET /trips: your plans from today on, soonest first. */
export async function listTrips(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT * FROM trip_plans WHERE user_id = ? AND date >= ? ORDER BY date, id")
    .bind(me.id, stockholmDate(now))
    .all<TripRow>();
  return { trips: rows.results.map(toPlan) };
}

/** POST /trips {regionId, date}: plans a tour; planning the same one again is fine. */
export async function createTrip(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  const body = await readJson<{ regionId?: unknown; date?: unknown }>(request);
  const regionId = typeof body.regionId === "string" ? body.regionId : "";
  if (!REGION_SOURCES.some((r) => r.id === regionId)) throw new HttpError(400, "Okänt område.");
  const date = typeof body.date === "string" && DATE.test(body.date) ? body.date : "";
  const today = stockholmDate(now);
  if (!date || date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    throw new HttpError(400, `Välj en dag från idag och ${MAX_DAYS_AHEAD} dagar framåt.`);
  }
  const existing = await env.DB.prepare("SELECT * FROM trip_plans WHERE user_id = ? AND region_id = ? AND date = ?")
    .bind(me.id, regionId, date)
    .first<TripRow>();
  if (existing) return { trip: toPlan(existing) };
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_plans WHERE user_id = ? AND date >= ?")
    .bind(me.id, today)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_UPCOMING) throw new HttpError(400, `Du kan ha högst ${MAX_UPCOMING} planerade turer.`);
  const r = await env.DB.prepare("INSERT INTO trip_plans (user_id, region_id, date, created_at) VALUES (?, ?, ?, ?)")
    .bind(me.id, regionId, date, nowIso())
    .run();
  return { trip: { id: Number(r.meta.last_row_id), regionId, date, notified: false } };
}

/** DELETE /trips/:id (your own). */
export async function deleteTrip(request: Request, env: CommunityEnv, id: number) {
  const me = await requireUser(request, env);
  const r = await env.DB.prepare("DELETE FROM trip_plans WHERE id = ? AND user_id = ?").bind(id, me.id).run();
  if (r.meta.changes === 0) throw new HttpError(404, "Turen finns inte.");
  return { ok: true };
}

/** A published forecast with a level, as recorded from the latest fetch. */
export interface PublishedDay {
  regionId: string;
  /** Swedish date the forecast is valid until, i.e. the day it is for. */
  date: string;
  danger: number;
  problemNames: string[];
}

export function tripMessage(day: PublishedDay): string {
  const problems = day.problemNames.length ? ` Lavinproblem: ${day.problemNames.join(", ")}.` : "";
  return (
    `Prognos för din tur ${swedishDay(day.date)} i ${regionName(day.regionId)}: ` +
    `${day.danger} ${DANGER_LABELS[day.danger]} lavinfara.${problems} Läs hela prognosen innan du går ut.`
  );
}

export function noLevelMessage(regionId: string, date: string): string {
  return (
    `Naturvårdsverket har inte publicerat någon farograd för ${swedishDay(date)} i ${regionName(regionId)}. ` +
    "Läs prognossidan innan du går ut och gör din egen bedömning."
  );
}

function stockholmHour(at: Date): number {
  return Number(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", hourCycle: "h23" }).format(at));
}

/**
 * After each forecast fetch: sends the forecast to everyone who planned a
 * tour on a day that now has a published level, and on the morning of a
 * tour day without one, says so. Each plan is notified once.
 */
export async function notifyTrips(env: NotifyEnv, published: PublishedDay[], now = new Date(), defer?: Defer): Promise<void> {
  const today = stockholmDate(now);
  await env.DB.prepare("DELETE FROM trip_plans WHERE date < ?").bind(addDays(today, -KEEP_PAST_DAYS)).run();
  const sent = nowIso();

  const due: Array<{ trip: TripRow; text: string }> = [];
  for (const day of published) {
    if (day.date < today) continue;
    const rows = await env.DB.prepare("SELECT * FROM trip_plans WHERE region_id = ? AND date = ? AND notified_at IS NULL")
      .bind(day.regionId, day.date)
      .all<TripRow>();
    for (const trip of rows.results) due.push({ trip, text: tripMessage(day) });
  }
  if (stockholmHour(now) >= MORNING_HOUR) {
    const withLevel = new Set(published.filter((d) => d.date === today).map((d) => d.regionId));
    const rows = await env.DB.prepare("SELECT * FROM trip_plans WHERE date = ? AND notified_at IS NULL").bind(today).all<TripRow>();
    for (const trip of rows.results) {
      if (!withLevel.has(trip.region_id)) due.push({ trip, text: noLevelMessage(trip.region_id, trip.date) });
    }
  }
  if (due.length === 0) return;

  await env.DB.batch(due.map(({ trip }) => env.DB.prepare("UPDATE trip_plans SET notified_at = ? WHERE id = ?").bind(sent, trip.id)));
  await notify(
    env,
    due.map(({ trip, text }) => ({
      userId: trip.user_id,
      kind: "trip" as const,
      actorId: trip.user_id,
      note: text,
      url: `/omrade/${trip.region_id}`,
    })),
    defer
  );
}
