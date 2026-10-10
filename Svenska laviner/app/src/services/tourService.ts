import { api, ApiError } from "./api";
import { cached, USER_SCOPE } from "./cache";
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
  // Signed in, the list can include followers-only tours: keep it with the account's data.
  const key = `${filter.token ? USER_SCOPE : ""}tours:${params}`;
  return cached(key, async () => (await api<{ tours: Tour[] }>(`/tours?${params}`, { token: filter.token })).tours);
}

/** Public lines of shared tours, for the heatmap. */
export async function fetchTourLines(filter: Omit<TourFilter, "limit" | "user" | "token"> = {}): Promise<TourLine[]> {
  const params = new URLSearchParams();
  if (filter.region) params.set("region", filter.region);
  if (filter.months?.length) params.set("months", filter.months.join(","));
  return (await api<{ lines: TourLine[] }>(`/tours/lines?${params}`)).lines;
}

export async function fetchMyTours(token: string): Promise<Tour[]> {
  return cached(`${USER_SCOPE}tours:mine`, async () => (await api<{ tours: Tour[] }>("/tours?mine=1&limit=200", { token })).tours);
}

export async function fetchTour(id: number, token: string | null): Promise<TourWithTrack> {
  return cached(`${token ? USER_SCOPE : ""}tour:${id}`, () => api<TourWithTrack>(`/tours/${id}`, { token }));
}

export interface NewTour {
  title: string;
  description: string;
  visibility: TourVisibility;
  hideEndsM: number;
  /** YYYY-MM-DD, only used when the track has no times. */
  date: string | null;
  points: TrackPoint[];
  /** Where an imported tour came from ("hc:<id>"); the server keeps one tour per source. */
  sourceRef?: string;
  /** Save even though one of your tours started at the same time. */
  allowDuplicate?: boolean;
}

export interface SimilarTour {
  id: number;
  title: string;
  startedAt: string;
}

/** You already have a tour that started at the same time with about the same length. */
export class SimilarTourError extends Error {
  similarTo: SimilarTour;
  constructor(message: string, similarTo: SimilarTour) {
    super(message);
    this.similarTo = similarTo;
  }
}

export async function createTour(token: string, tour: NewTour): Promise<Tour> {
  try {
    return (await api<{ tour: Tour }>("/tours", { method: "POST", token, json: tour })).tour;
  } catch (err) {
    const similar = err instanceof ApiError && err.status === 409 ? (err.data.similarTo as SimilarTour | undefined) : undefined;
    if (err instanceof ApiError && similar && typeof similar.id === "number") throw new SimilarTourError(err.message, similar);
    throw err;
  }
}

/** Sources of the tours you've imported (e.g. prefix "hc" for Health Connect). */
export async function fetchImportedSources(token: string, prefix: string): Promise<string[]> {
  return (await api<{ refs: string[] }>(`/tours/sources?prefix=${encodeURIComponent(prefix)}`, { token })).refs;
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
