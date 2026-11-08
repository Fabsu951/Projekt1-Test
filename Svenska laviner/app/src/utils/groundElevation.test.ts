import { describe, expect, it } from "vitest";
import { ElevationSampler } from "./elevation";
import { withGroundElevation } from "./groundElevation";
import type { TrackPoint } from "./trackImport";

const track: TrackPoint[] = [
  [67.9, 18.5, 900, 1],
  [67.91, 18.51, 950, 2],
];

describe("withGroundElevation", () => {
  it("uses the height model's heights when the tiles load", async () => {
    const sampler = new ElevationSampler(async () => ({ size: 2, heights: new Float32Array([1200, 1200, 1200, 1200]) }));
    const out = await withGroundElevation(track, sampler);
    expect(out.map((p) => p[2])).toEqual([1200, 1200]);
    expect(out.map((p) => p[3])).toEqual([1, 2]);
  });

  it("keeps the GPS heights when the tiles can't be loaded", async () => {
    const sampler = new ElevationSampler(async () => null);
    expect(await withGroundElevation(track, sampler)).toEqual(track);
  });

  it("keeps the GPS heights when loading takes too long", async () => {
    const sampler = new ElevationSampler(() => new Promise(() => {}));
    expect(await withGroundElevation(track, sampler, 20)).toEqual(track);
  });
});
