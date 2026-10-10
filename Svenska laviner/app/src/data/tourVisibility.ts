import type { Tour, TourVisibility } from "../types/tour";
import { t } from "../i18n";

export const VISIBILITY_CHOICES: Array<{ value: TourVisibility; label: string }> = [
  { value: "public", label: t("Alla") },
  { value: "followers", label: t("Bara de som följer mig") },
  { value: "private", label: t("Bara jag") },
];

/** Older workers only send `shared`. */
export function tourVisibility(tour: Pick<Tour, "shared" | "visibility">): TourVisibility {
  return tour.visibility ?? (tour.shared ? "public" : "private");
}
