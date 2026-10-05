import { describe, expect, it } from "vitest";
import { buildHeatGrid, cellSizeM, heatBand, heatRuns, toursAt, toursNear } from "./heatGrid";
import type { TourLine } from "../types/tour";

// A straight line north from Kebnekaise fjällstation, ~1.1 km long.
const route = (id: number, lonShift = 0): TourLine => ({
  id,
  points: Array.from({ length: 11 }, (_, i) => [67.85 + i * 0.001, 18.6 + lonShift] as [number, number]),
});

describe("heat grid", () => {
  const cellM = cellSizeM(13); // ~230 Mercator metres

  it("counts each tour once per square, and tours side by side as one route", () => {
    const grid = buildHeatGrid([route(1), route(2, 0.0002), route(3, 0.0001)], cellM);
    expect(toursAt(grid, [67.855, 18.6001]).sort()).toEqual([1, 2, 3]);
  });

  it("keeps tours far apart separate", () => {
    const grid = buildHeatGrid([route(1), route(2, 0.05)], cellM);
    expect(toursAt(grid, [67.855, 18.6])).toEqual([1]);
    expect(toursAt(grid, [67.855, 18.65])).toEqual([2]);
  });

  it("lights up only the shared stretch of a route", () => {
    const shared = route(1);
    const partly: TourLine = { id: 2, points: shared.points.slice(0, 5) };
    const runs = heatRuns([shared, partly], buildHeatGrid([shared, partly], cellM));
    const ofFirst = runs.filter((r) => r.lineId === 1);
    expect(ofFirst.map((r) => r.band).sort()).toEqual([0, 1]);
    expect(runs[0].band).toBeLessThanOrEqual(runs[runs.length - 1].band);
  });

  it("finds the tours under a tap that just misses the line", () => {
    const grid = buildHeatGrid([route(1), route(2)], cellM);
    expect(toursNear(grid, [67.855, 18.6025], 1).sort()).toEqual([1, 2]);
  });

  it("puts counts in the legend's bands", () => {
    expect([1, 2, 3, 4, 9, 10, 40].map(heatBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
