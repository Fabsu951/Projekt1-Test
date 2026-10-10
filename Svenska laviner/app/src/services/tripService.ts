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
}

/** A saved route and its steep ground ([sector, height, metres], see steepProfile). */
export interface TripRoute {
  routeId: number;
  steep: Array<[number, number, number]>;
}

export async function fetchTrips(token: string): Promise<TripPlan[]> {
  return (await api<{ trips: TripPlan[] }>("/trips", { token })).trips;
}

/** Plans a day; `route` adds or (null) removes a route, leaving it out keeps what is there. */
export async function planTrip(token: string, regionId: string, date: string, route?: TripRoute | null): Promise<TripPlan> {
  const json = route === undefined ? { regionId, date } : route === null ? { regionId, date, routeId: null } : { regionId, date, ...route };
  return (await api<{ trip: TripPlan }>("/trips", { method: "POST", token, json })).trip;
}

export async function removeTrip(token: string, id: number): Promise<void> {
  await api(`/trips/${id}`, { method: "DELETE", token });
}
