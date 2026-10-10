import { requireUser, type CommunityEnv } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { dayName, toLang, type Lang } from "./lang";
import { stockholmDate } from "./model";
import { notify, type Defer, type NotifyEnv } from "./notifications";
import { d1Store, enforce, record } from "./rateLimit";
import { REGION_SOURCES } from "./regions";

// "Gemensam turdag": whoever planned a tour day can invite people they
// follow. An invitation can be accepted (which plans the same day for the
// invitee, with the inviter's route comparison, so everyone gets the
// forecast notice) or declined. Only the people on the trip see who is on it.

const MAX_INVITES_PER_TRIP = 20;
const INVITE_LIMIT = { max: 40, windowMs: 24 * 3600 * 1000 };
const MAX_UPCOMING = 20;

const regionName = (id: string) => REGION_SOURCES.find((r) => r.id === id)?.name ?? id;

export interface Person {
  id: number;
  displayName: string;
}

export interface TripInvite {
  id: number;
  user: Person;
  status: "pending" | "accepted" | "declined";
}

export interface Invitation {
  id: number;
  from: Person;
  regionId: string;
  date: string;
  routeTitle: string | null;
}

function inviteText(lang: Lang, from: string, regionId: string, date: string): string {
  return lang === "en"
    ? `${from} invites you on a tour ${dayName(date, lang)} in ${regionName(regionId)}.`
    : `${from} bjuder in dig till en tur ${dayName(date, lang)} i ${regionName(regionId)}.`;
}

function joinText(lang: Lang, who: string, regionId: string, date: string): string {
  return lang === "en"
    ? `${who} is joining your tour ${dayName(date, lang)} in ${regionName(regionId)}.`
    : `${who} hänger med på din tur ${dayName(date, lang)} i ${regionName(regionId)}.`;
}

/** POST /trips/:id/invites {userIds}: invites people you follow to your planned day. */
export async function inviteToTrip(request: Request, env: NotifyEnv, tripId: number, defer?: Defer, now = new Date()) {
  const me = await requireUser(request, env);
  const trip = await env.DB.prepare("SELECT id, region_id, date FROM trip_plans WHERE id = ? AND user_id = ?")
    .bind(tripId, me.id)
    .first<{ id: number; region_id: string; date: string }>();
  if (!trip) throw new HttpError(404, "Turen finns inte.");
  if (trip.date < stockholmDate(now)) throw new HttpError(400, "Dagen har redan varit.");
  const body = await readJson<{ userIds?: unknown }>(request);
  const wanted = Array.isArray(body.userIds) ? [...new Set(body.userIds.map(Number))].filter((id) => Number.isInteger(id) && id !== me.id) : [];
  if (wanted.length === 0) throw new HttpError(400, "Välj vem du vill bjuda in.");

  // Only people you follow, and not twice.
  const placeholders = wanted.map(() => "?").join(", ");
  const allowed = await env.DB.prepare(
    `SELECT u.id, u.lang FROM follows f JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = ? AND u.id IN (${placeholders})
        AND u.id NOT IN (SELECT to_user FROM trip_invites WHERE trip_id = ?)`
  )
    .bind(me.id, ...wanted, trip.id)
    .all<{ id: number; lang: string }>();
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_invites WHERE trip_id = ?").bind(trip.id).first<{ n: number }>();
  if ((count?.n ?? 0) + allowed.results.length > MAX_INVITES_PER_TRIP) {
    throw new HttpError(400, `Du kan bjuda in högst ${MAX_INVITES_PER_TRIP} personer till en tur.`);
  }
  if (allowed.results.length) {
    const store = d1Store(env.DB);
    const key = `trip-invite:${me.id}`;
    await enforce(store, [{ key, ...INVITE_LIMIT }], "Du har bjudit in många den senaste tiden. Försök igen i morgon.");
    const at = nowIso();
    await env.DB.batch(
      allowed.results.map((u) =>
        env.DB.prepare("INSERT INTO trip_invites (trip_id, from_user, to_user, created_at) VALUES (?, ?, ?, ?)").bind(trip.id, me.id, u.id, at)
      )
    );
    await record(store, allowed.results.map(() => key));
    await notify(
      env,
      allowed.results.map((u) => ({
        userId: u.id,
        kind: "trip_invite" as const,
        actorId: me.id,
        note: inviteText(toLang(u.lang), me.displayName, trip.region_id, trip.date),
        url: `/omrade/${trip.region_id}#turdag`,
      })),
      defer
    );
  }
  return { invites: (await invitesOf(env, [trip.id]))[trip.id] ?? [] };
}

/** POST /trips/invitations/:id {accept}: accepting plans the same day for you. */
export async function answerInvitation(request: Request, env: NotifyEnv, inviteId: number, defer?: Defer, now = new Date()) {
  const me = await requireUser(request, env);
  const accept = (await readJson<{ accept?: unknown }>(request)).accept === true;
  const invite = await env.DB.prepare(
    `SELECT i.id, i.from_user, t.region_id, t.date, t.route_title, t.route_steep, u.lang AS from_lang
       FROM trip_invites i JOIN trip_plans t ON t.id = i.trip_id JOIN users u ON u.id = i.from_user
      WHERE i.id = ? AND i.to_user = ? AND i.status = 'pending'`
  )
    .bind(inviteId, me.id)
    .first<{ id: number; from_user: number; region_id: string; date: string; route_title: string | null; route_steep: string | null; from_lang: string }>();
  if (!invite) throw new HttpError(404, "Inbjudan finns inte längre.");
  const at = nowIso();
  if (!accept) {
    await env.DB.prepare("UPDATE trip_invites SET status = 'declined', answered_at = ? WHERE id = ?").bind(at, invite.id).run();
    return { accepted: false };
  }
  if (invite.date < stockholmDate(now)) throw new HttpError(400, "Dagen har redan varit.");

  let mine = await env.DB.prepare("SELECT id, route_title FROM trip_plans WHERE user_id = ? AND region_id = ? AND date = ?")
    .bind(me.id, invite.region_id, invite.date)
    .first<{ id: number; route_title: string | null }>();
  if (!mine) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_plans WHERE user_id = ? AND date >= ?")
      .bind(me.id, stockholmDate(now))
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_UPCOMING) throw new HttpError(400, `Du kan ha högst ${MAX_UPCOMING} planerade turer.`);
    // The inviter's route comparison comes along (a snapshot, not the route itself).
    const r = await env.DB.prepare(
      "INSERT INTO trip_plans (user_id, region_id, date, created_at, route_title, route_steep) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(me.id, invite.region_id, invite.date, at, invite.route_title, invite.route_steep)
      .run();
    mine = { id: Number(r.meta.last_row_id), route_title: invite.route_title };
  }
  await env.DB.prepare("UPDATE trip_invites SET status = 'accepted', answered_at = ?, joined_trip_id = ? WHERE id = ?")
    .bind(at, mine.id, invite.id)
    .run();
  await notify(
    env,
    [
      {
        userId: invite.from_user,
        kind: "trip_join",
        actorId: me.id,
        note: joinText(toLang(invite.from_lang), me.displayName, invite.region_id, invite.date),
        url: `/omrade/${invite.region_id}#turdag`,
      },
    ],
    defer
  );
  return { accepted: true, tripId: mine.id };
}

/** The invitations sent for each of these trips. */
export async function invitesOf(env: CommunityEnv, tripIds: number[]): Promise<Record<number, TripInvite[]>> {
  if (!tripIds.length) return {};
  const rows = await env.DB.prepare(
    `SELECT i.id, i.trip_id, i.status, u.id AS user_id, u.display_name
       FROM trip_invites i JOIN users u ON u.id = i.to_user
      WHERE i.trip_id IN (${tripIds.map(() => "?").join(", ")}) ORDER BY u.display_name`
  )
    .bind(...tripIds)
    .all<{ id: number; trip_id: number; status: TripInvite["status"]; user_id: number; display_name: string }>();
  const out: Record<number, TripInvite[]> = {};
  for (const r of rows.results) (out[r.trip_id] ??= []).push({ id: r.id, status: r.status, user: { id: r.user_id, displayName: r.display_name } });
  return out;
}

/** For trips you joined: who else is on them (the inviter and the others who said yes). */
export async function companyOf(env: CommunityEnv, userId: number, tripIds: number[]): Promise<Record<number, Person[]>> {
  if (!tripIds.length) return {};
  const rows = await env.DB.prepare(
    `SELECT mine.joined_trip_id AS trip, u.id, u.display_name
       FROM trip_invites mine
       JOIN trip_plans t ON t.id = mine.trip_id
       JOIN users u ON u.id = t.user_id
      WHERE mine.to_user = ? AND mine.status = 'accepted' AND mine.joined_trip_id IN (${tripIds.map(() => "?").join(", ")})
     UNION
     SELECT mine.joined_trip_id AS trip, u.id, u.display_name
       FROM trip_invites mine
       JOIN trip_invites other ON other.trip_id = mine.trip_id AND other.status = 'accepted' AND other.to_user != mine.to_user
       JOIN users u ON u.id = other.to_user
      WHERE mine.to_user = ? AND mine.status = 'accepted' AND mine.joined_trip_id IN (${tripIds.map(() => "?").join(", ")})`
  )
    .bind(userId, ...tripIds, userId, ...tripIds)
    .all<{ trip: number; id: number; display_name: string }>();
  const out: Record<number, Person[]> = {};
  for (const r of rows.results) (out[r.trip] ??= []).push({ id: r.id, displayName: r.display_name });
  return out;
}

/** Invitations waiting for your answer, for days still to come. */
export async function pendingInvitations(env: CommunityEnv, userId: number, today: string): Promise<Invitation[]> {
  const rows = await env.DB.prepare(
    `SELECT i.id, u.id AS from_id, u.display_name, t.region_id, t.date, t.route_title
       FROM trip_invites i JOIN trip_plans t ON t.id = i.trip_id JOIN users u ON u.id = i.from_user
      WHERE i.to_user = ? AND i.status = 'pending' AND t.date >= ? ORDER BY t.date, i.id`
  )
    .bind(userId, today)
    .all<{ id: number; from_id: number; display_name: string; region_id: string; date: string; route_title: string | null }>();
  return rows.results.map((r) => ({
    id: r.id,
    from: { id: r.from_id, displayName: r.display_name },
    regionId: r.region_id,
    date: r.date,
    routeTitle: r.route_title,
  }));
}
