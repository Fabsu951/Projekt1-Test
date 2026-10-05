import { describe, expect, it } from "vitest";
import { ElevationSampler, type TileLoader } from "./elevation";
import { analyseRoute, densify, distanceM, formatHours, munterHours, routeToGpx, slopeBand, slopeRuns } from "./routePlan";
import { parseGpx } from "./trackImport";

// A fake world where the ground rises `grade` metres per metre northwards,
// so the true slope is atan(grade) everywhere and it faces south.
function rampLoader(grade: number, base = 500): TileLoader {
  return async (z, _x, y) => {
    const size = 64;
    const heights = new Float32Array(size * size);
    const n = 2 ** z;
    for (let py = 0; py < size; py++) {
      const ty = y + (py + 0.5) / size;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
      for (let px = 0; px < size; px++) heights[py * size + px] = base + (lat - 67.85) * 111320 * grade;
    }
    return { size, heights };
  };
}

const north = (km: number): Array<[number, number]> => [
  [67.85, 18.6],
  [67.85 + (km * 1000) / 111320, 18.6],
];

describe("route planning", () => {
  it("samples the route every 25 m and keeps the waypoints", () => {
    const pts = densify([[67.85, 18.6], [67.851, 18.6], [67.851, 18.603]]);
    expect(pts[0].distM).toBe(0);
    expect(pts.at(-1)!.distM).toBeCloseTo(distanceM([67.85, 18.6], [67.851, 18.6]) + distanceM([67.851, 18.6], [67.851, 18.603]), 6);
    for (let i = 1; i < pts.length; i++) expect(pts[i].distM - pts[i - 1].distM).toBeLessThanOrEqual(25.001);
  });

  it("reads height, slope and aspect from the elevation tiles", async () => {
    const grade = Math.tan((32 * Math.PI) / 180); // a 32° slope rising northwards, facing south
    const r = await analyseRoute(north(1), new ElevationSampler(rampLoader(grade)));
    expect(r.distanceM).toBeCloseTo(1000, -1);
    expect(r.ascentM).toBeGreaterThan(560);
    expect(r.ascentM).toBeLessThan(690);
    expect(r.descentM).toBe(0);
    expect(r.maxSlope!).toBeGreaterThan(30);
    expect(r.maxSlope!).toBeLessThan(34);
    expect(r.samples[5].aspect!).toBeGreaterThan(170);
    expect(r.samples[5].aspect!).toBeLessThan(190);
    expect(r.bandLengthsM[slopeBand(32)]).toBeGreaterThan(900);
    expect(r.incomplete).toBe(false);
  });

  it("splits the route into coloured stretches by steepness", async () => {
    const r = await analyseRoute(north(0.5), new ElevationSampler(rampLoader(0.1)));
    const runs = slopeRuns(r.samples);
    expect(runs).toHaveLength(1);
    expect(runs[0].band).toBe(0);
    expect(runs[0].positions).toHaveLength(r.samples.length);
  });

  it("says when heights are missing instead of guessing", async () => {
    const r = await analyseRoute(north(1), new ElevationSampler(async () => null));
    expect(r.incomplete).toBe(true);
    expect(r.maxElevationM).toBeNull();
    expect(r.ascentM).toBe(0);
  });

  it("estimates time with the Munter method", () => {
    // 4 km and 800 m up: (4 + 8) / 4 = 3 h; 4 km and 800 m down: (4 + 4) / 10 = 0.8 h.
    expect(munterHours([{ km: 4, climbM: 800 }])).toBeCloseTo(3);
    expect(munterHours([{ km: 4, climbM: -800 }])).toBeCloseTo(0.8);
    expect(formatHours(3.8)).toBe("3 h 50 min");
    expect(formatHours(0.5)).toBe("30 min");
  });

  it("exports a GPX track the tour diary can read back", async () => {
    const r = await analyseRoute(north(0.3), new ElevationSampler(rampLoader(0.2)));
    const gpx = routeToGpx("Min <rutt>", r.samples);
    expect(gpx).toContain("<name>Min &lt;rutt&gt;</name>");
    const back = parseGpx(gpx);
    expect(back).toHaveLength(r.samples.length);
    expect(back[0][2]).toBeCloseTo(500, 0);
  });
});
