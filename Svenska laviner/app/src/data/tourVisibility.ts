import type { Tour, TourVisibility } from "../types/tour";

export const VISIBILITY_CHOICES: Array<{ value: TourVisibility; label: string }> = [
  { value: "public", label: "Alla" },
  { value: "followers", label: "Bara de som följer mig" },
  { value: "private", label: "Bara jag" },
];

/** Older workers only send `shared`. */
export function tourVisibility(tour: Pick<Tour, "shared" | "visibility">): TourVisibility {
  return tour.visibility ?? (tour.shared ? "public" : "private");
}
