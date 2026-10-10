import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { addDays } from "./history";
import { stockholmDate } from "./model";
import { notify, type Defer, type NotifyEnv } from "./notifications";
import { REGION_SOURCES } from "./regions";
import { compass, dangerText, dayName, problemName, toLang, type Lang } from "./lang";

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

/** "lördag 14 feb" */
export const swedishDay = (date: string) => dayName(date, "sv");

const regionName = (id: string) => REGION_SOURCES.find((r) => r.id === id)?.name ?? id;

export interface TripPlan {
  id: number;
  regionId: string;
  date: string;
  notified: boolean;
  /** A saved route to compare with the forecast, if one was chosen. */
  routeId?: number | null;
  routeTitle?: string | null;
}

interface TripRow {
  id: number;
  user_id: number;
  region_id: string;
  date: string;
  notified_at: string | null;
  route_id: number | null;
  route_title: string | null;
  route_steep: string | null;
}

const toPlan = (r: TripRow): TripPlan => ({
  id: r.id,
  regionId: r.region_id,
  date: r.date,
  notified: r.notified_at !== null,
  routeId: r.route_id,
  routeTitle: r.route_title,
});

/** GET /trips: your plans from today on, soonest first. */
export async function listTrips(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT * FROM trip_plans WHERE user_id = ? AND date >= ? ORDER BY date, id")
    .bind(me.id, stockholmDate(now))
    .all<TripRow>();
  return { trips: rows.results.map(toPlan) };
}

/** Steep ground under a route: [aspect sector 0–7 (N, NO, O … NV), height in m, metres of route]. */
export type SteepPiece = [number, number, number];
const MAX_STEEP_PIECES = 3000;

function readSteep(value: unknown): SteepPiece[] | null {
  if (!Array.isArray(value) || value.length > MAX_STEEP_PIECES) return null;
  const out: SteepPiece[] = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 3) return null;
    const [sector, height, metres] = p.map(Number);
    if (!Number.isInteger(sector) || sector < 0 || sector > 7) return null;
    if (!Number.isFinite(height) || height < -100 || height > 3000) return null;
    if (!Number.isFinite(metres) || metres <= 0 || metres > 5000) return null;
    out.push([sector, Math.round(height), Math.round(metres)]);
  }
  return out;
}

interface TripBody {
  regionId?: unknown;
  date?: unknown;
  /** One of your saved routes, or null to drop it; leave out to keep what's there. */
  routeId?: unknown;
  steep?: unknown;
}

/**
 * POST /trips {regionId, date, routeId?, steep?}: plans a tour; planning the
 * same day again keeps it, and updates (or with routeId null removes) the route.
 */
export async function createTrip(request: Request, env: CommunityEnv, now = new Date()) {
  const me = await requireUser(request, env);
  const body = await readJson<TripBody>(request);
  const regionId = typeof body.regionId === "string" ? body.regionId : "";
  if (!REGION_SOURCES.some((r) => r.id === regionId)) throw new HttpError(400, "Okänt område.");
  const date = typeof body.date === "string" && DATE.test(body.date) ? body.date : "";
  const today = stockholmDate(now);
  if (!date || date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    throw new HttpError(400, `Välj en dag från idag och ${MAX_DAYS_AHEAD} dagar framåt.`);
  }

  let route: { id: number; title: string; steep: string } | null | undefined;
  if (body.routeId === null) route = null;
  else if (body.routeId !== undefined) {
    const owned = await env.DB.prepare("SELECT id, title FROM routes WHERE id = ? AND user_id = ?")
      .bind(Number(body.routeId), me.id)
      .first<{ id: number; title: string }>();
    if (!owned) throw new HttpError(400, "Rutten finns inte bland dina sparade rutter.");
    const steep = readSteep(body.steep);
    if (!steep) throw new HttpError(400, "Ruttens lutningsdata gick inte att läsa.");
    route = { id: owned.id, title: owned.title, steep: JSON.stringify(steep) };
  }

  const existing = await env.DB.prepare("SELECT * FROM trip_plans WHERE user_id = ? AND region_id = ? AND date = ?")
    .bind(me.id, regionId, date)
    .first<TripRow>();
  if (existing) {
    if (route === undefined) return { trip: toPlan(existing) };
    await env.DB.prepare("UPDATE trip_plans SET route_id = ?, route_title = ?, route_steep = ? WHERE id = ?")
      .bind(route?.id ?? null, route?.title ?? null, route?.steep ?? null, existing.id)
      .run();
    return { trip: { ...toPlan(existing), routeId: route?.id ?? null, routeTitle: route?.title ?? null } };
  }
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_plans WHERE user_id = ? AND date >= ?")
    .bind(me.id, today)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_UPCOMING) throw new HttpError(400, `Du kan ha högst ${MAX_UPCOMING} planerade turer.`);
  const r = await env.DB.prepare(
    "INSERT INTO trip_plans (user_id, region_id, date, created_at, route_id, route_title, route_steep) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(me.id, regionId, date, nowIso(), route?.id ?? null, route?.title ?? null, route?.steep ?? null)
    .run();
  return {
    trip: { id: Number(r.meta.last_row_id), regionId, date, notified: false, routeId: route?.id ?? null, routeTitle: route?.title ?? null },
  };
}

/** DELETE /trips/:id (your own). */
export async function deleteTrip(request: Request, env: CommunityEnv, id: number) {
  const me = await requireUser(request, env);
  const r = await env.DB.prepare("DELETE FROM trip_plans WHERE id = ? AND user_id = ?").bind(id, me.id).run();
  if (r.meta.changes === 0) throw new HttpError(404, "Turen finns inte.");
  return { ok: true };
}

/** One avalanche problem of a published forecast, as far as the route check needs it. */
export interface PublishedProblem {
  type: string;
  name: string;
  aspects: string[];
  elevations: string[];
  metersAbove: number | null;
  metersBelow: number | null;
}

/** A published forecast with a level, as recorded from the latest fetch. */
export interface PublishedDay {
  regionId: string;
  /** Swedish date the forecast is valid until, i.e. the day it is for. */
  date: string;
  danger: number;
  problems: PublishedProblem[];
}

// The route check follows the app's (app/src/utils/routeForecast.ts):
// steep ground (>= 30°) facing a problem's aspects at its heights, with
// edges widened so borderline cases are flagged rather than missed.
const SECTORS = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
export const STEEP_DEG = 30;
const TREELINE_M: Record<string, number> = {
  riksgransfjallen: 600,
  kebnekaisefjallen: 650,
  "vastra-vindelfjallen": 750,
  "sodra-lapplandsfjallen": 750,
  "sodra-jamtlandsfjallen": 850,
  "vastra-harjedalsfjallen": 900,
};
const TREELINE_ZONE_M = 100;
const MARGIN_M = 50;

function bandsAt(height: number, treeline: number): string[] {
  const bands: string[] = [];
  if (height >= treeline + TREELINE_ZONE_M - MARGIN_M) bands.push("kalfjall");
  if (Math.abs(height - treeline) <= TREELINE_ZONE_M + MARGIN_M) bands.push("tradgrans");
  if (height <= treeline - TREELINE_ZONE_M + MARGIN_M) bands.push("under_tradgrans");
  return bands;
}

function matches(problem: PublishedProblem, [sector, height]: SteepPiece, treeline: number): boolean {
  if (problem.aspects.length > 0 && !problem.aspects.includes(SECTORS[sector])) return false;
  if (problem.metersAbove !== null || problem.metersBelow !== null) {
    if (problem.metersAbove !== null && height < problem.metersAbove - MARGIN_M) return false;
    if (problem.metersBelow !== null && height > problem.metersBelow + MARGIN_M) return false;
    return true;
  }
  return problem.elevations.length === 0 || bandsAt(height, treeline).some((b) => problem.elevations.includes(b));
}

export interface RouteHit {
  problem: PublishedProblem;
  metres: number;
  sectors: string[];
}

/** Where a route's steep ground meets each of the forecast's problems. */
export function checkRoute(steep: SteepPiece[], day: PublishedDay): RouteHit[] {
  const treeline = TREELINE_M[day.regionId] ?? 750;
  return day.problems.flatMap((problem) => {
    let metres = 0;
    const sectors = new Set<number>();
    for (const piece of steep) {
      if (!matches(problem, piece, treeline)) continue;
      metres += piece[2];
      sectors.add(piece[0]);
    }
    return metres > 0 ? [{ problem, metres, sectors: SECTORS.filter((_, i) => sectors.has(i)) }] : [];
  });
}

/** "ca 350 m", rounded to 50 m (at least 50). */
const roughly = (m: number, lang: Lang) => `${lang === "en" ? "about" : "ca"} ${Math.max(50, Math.round(m / 50) * 50)} m`;

function routeSentence(title: string, steep: SteepPiece[], day: PublishedDay, lang: Lang): string {
  const hits = checkRoute(steep, day);
  const en = lang === "en";
  if (hits.length === 0) {
    return en
      ? ` Your route ”${title}”: no steep ground (over ${STEEP_DEG}°) found under it in the forecast's aspects and heights – that does not make it safe; slopes above it can still release.`
      : ` Din rutt ”${title}”: ingen brant mark (över ${STEEP_DEG}°) under den i prognosens väderstreck och höjder – det betyder inte att den är säker, sluttningar ovanför kan ändå släppa.`;
  }
  const list = hits
    .map((h) => `${problemName(h.problem, lang)} ${roughly(h.metres, lang)} (${h.sectors.map((s) => compass(s, lang)).join(", ")})`)
    .join("; ");
  return en
    ? ` Your route ”${title}” crosses steep ground (over ${STEEP_DEG}°) where the forecast places: ${list}. Check the route in the map before you go.`
    : ` Din rutt ”${title}” går över brant mark (över ${STEEP_DEG}°) där prognosen anger: ${list}. Se rutten i kartan innan du går.`;
}

export function tripMessage(day: PublishedDay, lang: Lang = "sv", route?: { title: string; steep: SteepPiece[] }): string {
  const names = day.problems.map((p) => problemName(p, lang));
  const routePart = route ? routeSentence(route.title, route.steep, day, lang) : "";
  if (lang === "en") {
    const problems = names.length ? ` Avalanche problems: ${names.join(", ")}.` : "";
    return (
      `Forecast for your tour ${dayName(day.date, lang)} in ${regionName(day.regionId)}: ${dangerText(day.danger, lang)}.` +
      `${problems}${routePart} Read the whole forecast before you go out.`
    );
  }
  const problems = names.length ? ` Lavinproblem: ${names.join(", ")}.` : "";
  return (
    `Prognos för din tur ${dayName(day.date, lang)} i ${regionName(day.regionId)}: ${dangerText(day.danger, lang)}.` +
    `${problems}${routePart} Läs hela prognosen innan du går ut.`
  );
}

export function noLevelMessage(regionId: string, date: string, lang: Lang = "sv"): string {
  return lang === "en"
    ? `Naturvårdsverket has not published a danger level for ${dayName(date, lang)} in ${regionName(regionId)}. ` +
        "Read the forecast page before you go out and make your own assessment."
    : `Naturvårdsverket har inte publicerat någon farograd för ${dayName(date, lang)} i ${regionName(regionId)}. ` +
        "Läs prognossidan innan du går ut och gör din egen bedömning.";
}

function routeOf(trip: TripRow): { title: string; steep: SteepPiece[] } | undefined {
  if (trip.route_id === null || !trip.route_steep || !trip.route_title) return undefined;
  try {
    const steep = readSteep(JSON.parse(trip.route_steep));
    return steep ? { title: trip.route_title, steep } : undefined;
  } catch {
    return undefined;
  }
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

  type Due = TripRow & { lang: string };
  const due: Array<{ trip: Due; text: string }> = [];
  for (const day of published) {
    if (day.date < today) continue;
    const rows = await env.DB.prepare(
      `SELECT t.*, u.lang FROM trip_plans t JOIN users u ON u.id = t.user_id
        WHERE t.region_id = ? AND t.date = ? AND t.notified_at IS NULL`
    )
      .bind(day.regionId, day.date)
      .all<Due>();
    for (const trip of rows.results) due.push({ trip, text: tripMessage(day, toLang(trip.lang), routeOf(trip)) });
  }
  if (stockholmHour(now) >= MORNING_HOUR) {
    const withLevel = new Set(published.filter((d) => d.date === today).map((d) => d.regionId));
    const rows = await env.DB.prepare(
      "SELECT t.*, u.lang FROM trip_plans t JOIN users u ON u.id = t.user_id WHERE t.date = ? AND t.notified_at IS NULL"
    )
      .bind(today)
      .all<Due>();
    for (const trip of rows.results) {
      if (!withLevel.has(trip.region_id)) due.push({ trip, text: noLevelMessage(trip.region_id, trip.date, toLang(trip.lang)) });
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
