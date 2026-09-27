import { describe, expect, it } from "vitest";
import { bounds, cleanPoints, distanceM, trackStats, trimEnds, type TrackPoint } from "./track";

/** A straight line north from Kebnekaise fjällstation, one point every ~111 m. */
function line(n: number, ele: (i: number) => number | null = () => 700, t0 = Date.UTC(2027, 2, 10, 8)): TrackPoint[] {
  return Array.from({ length: n }, (_, i) => [67.85 + i * 0.001, 18.6, ele(i), t0 + i * 60_000]);
}

describe("cleanPoints", () => {
  it("drops malformed points and keeps the rest", () => {
    const points = cleanPoints([[67.8, 18.6, 700, 1], "x", [95, 18, 1, 1], [67.81, 18.6, "hög", -5], [67.82, 18.6]]);
    expect(points).toEqual([
      [67.8, 18.6, 700, 1],
      [67.81, 18.6, null, null],
      [67.82, 18.6, null, null],
    ]);
  });

  it("refuses tracks with too few or too many points", () => {
    expect(() => cleanPoints([[67.8, 18.6]])).toThrow(/minst två/);
    expect(() => cleanPoints(Array.from({ length: 5001 }, () => [67.8, 18.6]))).toThrow(/för många/);
    expect(() => cleanPoints("spår")).toThrow();
  });
});

describe("trackStats", () => {
  it("measures distance, time and ignores small elevation noise", () => {
    const noisy = line(11, (i) => 700 + (i % 2 === 0 ? 0 : 3)); // ±3 m jitter only
    const stats = trackStats(noisy);
    expect(stats.distanceM).toBeGreaterThan(1100);
    expect(stats.distanceM).toBeLessThan(1125);
    expect(stats.ascentM).toBe(0);
    expect(stats.descentM).toBe(0);
    expect(stats.durationS).toBe(600);
    expect(stats.startedAt).toBe("2027-03-10T08:00:00.000Z");
  });

  it("counts a real climb and descent", () => {
    const up = line(21, (i) => (i <= 10 ? 700 + i * 20 : 900 - (i - 10) * 20));
    const stats = trackStats(up);
    expect(stats.ascentM).toBe(200);
    expect(stats.descentM).toBe(200);
    expect(stats.maxElevationM).toBe(900);
  });

  it("copes with tracks without elevation or time", () => {
    const stats = trackStats(line(3, () => null).map((p) => [p[0], p[1], null, null]));
    expect(stats).toMatchObject({ ascentM: 0, maxElevationM: null, startedAt: null, durationS: null });
  });
});

describe("trimEnds", () => {
  it("removes the first and last stretch so the start and end aren't shown", () => {
    const points = line(30); // ~3.2 km
    const trimmed = trimEnds(points, 500);
    expect(distanceM(points[0], trimmed[0])).toBeGreaterThanOrEqual(500);
    expect(distanceM(trimmed.at(-1)!, points.at(-1)!)).toBeGreaterThanOrEqual(500);
    expect(trimmed.length).toBeLessThan(points.length);
  });

  it("shows nothing of a track shorter than both hidden ends, and everything with 0 m", () => {
    expect(trimEnds(line(5), 500)).toEqual([]);
    expect(trimEnds(line(5), 0)).toHaveLength(5);
  });
});

describe("bounds", () => {
  it("encloses every point", () => {
    const b = bounds(line(3));
    expect(b.minLat).toBeCloseTo(67.85, 9);
    expect(b.maxLat).toBeCloseTo(67.852, 9);
    expect([b.minLon, b.maxLon]).toEqual([18.6, 18.6]);
  });
});
