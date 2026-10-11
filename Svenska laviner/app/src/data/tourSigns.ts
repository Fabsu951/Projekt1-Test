import type { DangerSign } from "../types/observation";

/**
 * Warning signs seen on a tour. `null` = not answered, `[]` = "inga
 * varningstecken": a day out without signs tells others something too.
 */
export type TourSigns = DangerSign[] | null;

/** "Inga varningstecken" clears the signs, a sign clears it, tapping the chosen one again unsets it. */
export function toggleTourSign(value: TourSigns, choice: DangerSign | "none"): TourSigns {
  if (choice === "none") return value !== null && value.length === 0 ? null : [];
  const signs = value ?? [];
  const next = signs.includes(choice) ? signs.filter((s) => s !== choice) : [...signs, choice];
  return next.length === 0 && signs.length > 0 ? null : next;
}
