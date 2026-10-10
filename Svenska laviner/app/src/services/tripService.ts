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
}

export async function fetchTrips(token: string): Promise<TripPlan[]> {
  return (await api<{ trips: TripPlan[] }>("/trips", { token })).trips;
}

export async function planTrip(token: string, regionId: string, date: string): Promise<TripPlan> {
  return (await api<{ trip: TripPlan }>("/trips", { method: "POST", token, json: { regionId, date } })).trip;
}

export async function removeTrip(token: string, id: number): Promise<void> {
  await api(`/trips/${id}`, { method: "DELETE", token });
}
