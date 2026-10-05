import { api } from "./api";
import type { Tour, TourLine, TourVisibility, TourWithTrack } from "../types/tour";
import type { TrackPoint } from "../utils/trackImport";

export interface TourFilter {
  region?: string;
  /** Only this person's tours. */
  user?: number;
  /** Signed in, so followers-only tours of people you follow are included. */
  token?: string | null;
  months?: number[];
  limit?: number;
}

export async function fetchTours(filter: TourFilter = {}): Promise<Tour[]> {
  const params = new URLSearchParams();
  if (filter.region) params.set("region", filter.region);
  if (filter.months?.length) params.set("months", filter.months.join(","));
  if (filter.user) params.set("user", String(filter.user));
  params.set("limit", String(filter.limit ?? 100));
  return (await api<{ tours: Tour[] }>(`/tours?${params}`, { token: filter.token })).tours;
}

/** Public lines of shared tours, for the heatmap. */
export async function fetchTourLines(filter: Omit<TourFilter, "limit" | "user" | "token"> = {}): Promise<TourLine[]> {
  const params = new URLSearchParams();
  if (filter.region) params.set("region", filter.region);
  if (filter.months?.length) params.set("months", filter.months.join(","));
  return (await api<{ lines: TourLine[] }>(`/tours/lines?${params}`)).lines;
}

export async function fetchMyTours(token: string): Promise<Tour[]> {
  return (await api<{ tours: Tour[] }>("/tours?mine=1&limit=200", { token })).tours;
}

export async function fetchTour(id: number, token: string | null): Promise<TourWithTrack> {
  return api<TourWithTrack>(`/tours/${id}`, { token });
}

export interface NewTour {
  title: string;
  description: string;
  visibility: TourVisibility;
  hideEndsM: number;
  /** YYYY-MM-DD, only used when the track has no times. */
  date: string | null;
  points: TrackPoint[];
}

export async function createTour(token: string, tour: NewTour): Promise<Tour> {
  return (await api<{ tour: Tour }>("/tours", { method: "POST", token, json: tour })).tour;
}

export async function updateTour(
  token: string,
  id: number,
  changes: Partial<Pick<Tour, "title" | "description" | "hideEndsM">> & { visibility?: TourVisibility }
): Promise<Tour> {
  return (await api<{ tour: Tour }>(`/tours/${id}`, { method: "POST", token, json: changes })).tour;
}

export async function deleteTour(token: string, id: number): Promise<void> {
  await api(`/tours/${id}`, { method: "DELETE", token });
}
