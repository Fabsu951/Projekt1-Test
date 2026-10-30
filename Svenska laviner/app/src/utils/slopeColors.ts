import { SLOPE_BANDS } from "./routePlan";

// Slope is drawn in the same steps as the route planner (SLOPE_BANDS:
// 30/35/40/45°); flatter ground stays transparent so the map underneath
// stays readable.
const BANDS = SLOPE_BANDS.slice(1).map((band) => ({
  below: band.below,
  rgb: [1, 3, 5].map((i) => parseInt(band.color.slice(i, i + 2), 16)) as [number, number, number],
}));
const FLAT_MIN_DEG = SLOPE_BANDS[0].below;
/** Returned for ground under 30°; swapped for a transparent pixel below. */
export const FLAT: [number, number, number] = [1, 2, 3];

export function slopeColor(slopeDegrees: number): [number, number, number] {
  if (slopeDegrees < FLAT_MIN_DEG) return FLAT;
  return (BANDS.find((b) => slopeDegrees < b.below) ?? BANDS[BANDS.length - 1]).rgb;
}
