import { ElevationSampler } from "./elevation";
import type { TrackPoint } from "./trackImport";

/**
 * Swaps a phone's GPS heights (often ±10–20 m, which adds false climbing)
 * for the ground height from the same 1 m height models the route planner
 * uses (Mapterhorn). Keeps the GPS heights when the tiles can't be loaded in
 * time or don't cover nearly the whole track, since mixing the two sources
 * would add false steps.
 */
export async function withGroundElevation(points: TrackPoint[], sampler = new ElevationSampler(), timeoutMs = 15_000): Promise<TrackPoint[]> {
  if (points.length < 2) return points;
  const loaded = sampler.ready(points.map((p) => [p[0], p[1]])).then(
    () => true,
    () => false,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ok = await Promise.race([loaded, late]);
  clearTimeout(timer);
  if (!ok) return points;
  let found = 0;
  const out = points.map((p): TrackPoint => {
    const h = sampler.heightSync(p[0], p[1]);
    if (h === null || !Number.isFinite(h)) return p;
    found++;
    return [p[0], p[1], Math.round(h * 10) / 10, p[3]];
  });
  return found >= points.length * 0.95 ? out : points;
}
