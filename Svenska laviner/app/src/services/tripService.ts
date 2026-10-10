import { api } from "./api";

// "Prognos inför turen" (worker/src/trips.ts): plan a day in an area and get
// that day's forecast as a notification when it is published.

export interface TripPlan {
  id: number;
  regionId: string;
  /** YYYY-MM-DD */
  date: string;
  /** The forecast (or "no level published") has been sent. */
  notified: boolean;
  /** A saved route the notice compares with the forecast. */
  routeId?: number | null;
  routeTitle?: string | null;
  /** People you invited to this day, and their answers. */
  invites?: TripInvite[];
  /** On a day you were invited to: who else is going. */
  company?: Array<{ id: number; displayName: string }>;
}

export interface TripInvite {
  id: number;
  user: { id: number; displayName: string };
  status: "pending" | "accepted" | "declined";
}

/** An invitation to someone else's tour day, waiting for your answer. */
export interface TripInvitation {
  id: number;
  from: { id: number; displayName: string };
  regionId: string;
  date: string;
  routeTitle: string | null;
}

/** A saved route and its steep ground ([sector, height, metres], see steepProfile). */
export interface TripRoute {
  routeId: number;
  steep: Array<[number, number, number]>;
}

export async function fetchTrips(token: string): Promise<TripPlan[]> {
  return (await fetchTripsAndInvitations(token)).trips;
}

export async function fetchTripsAndInvitations(token: string): Promise<{ trips: TripPlan[]; invitations: TripInvitation[] }> {
  const r = await api<{ trips: TripPlan[]; invitations?: TripInvitation[] }>("/trips", { token });
  return { trips: r.trips, invitations: r.invitations ?? [] };
}

export async function inviteToTrip(token: string, tripId: number, userIds: number[]): Promise<TripInvite[]> {
  return (await api<{ invites: TripInvite[] }>(`/trips/${tripId}/invites`, { method: "POST", token, json: { userIds } })).invites;
}

/** Accepting plans the same day for you; the answer then has its id. */
export async function answerInvitation(token: string, id: number, accept: boolean): Promise<{ accepted: boolean; tripId?: number }> {
  return api(`/trips/invitations/${id}`, { method: "POST", token, json: { accept } });
}

/** Plans a day; `route` adds or (null) removes a route, leaving it out keeps what is there. */
export async function planTrip(token: string, regionId: string, date: string, route?: TripRoute | null): Promise<TripPlan> {
  const json = route === undefined ? { regionId, date } : route === null ? { regionId, date, routeId: null } : { regionId, date, ...route };
  return (await api<{ trip: TripPlan }>("/trips", { method: "POST", token, json })).trip;
}

export async function removeTrip(token: string, id: number): Promise<void> {
  await api(`/trips/${id}`, { method: "DELETE", token });
}
