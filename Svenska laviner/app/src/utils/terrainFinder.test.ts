import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER,
  forecastFilter,
  matchesTerrain,
  nearestArea,
  sectorOf,
  sectorSummary as summary,
  slopeAspect,
  withRange,
  type TerrainFilter,
} from "./terrainFinder";

const PIXEL_M = 10;

/** A 3×3 window (leaflet-relief layout) of a plane `deg` steep facing `aspect`. */
function plane(deg: number, aspect: number): number[] {
  const drop = Math.tan((deg * Math.PI) / 180);
  const a = (aspect * Math.PI) / 180;
  const win: number[] = [];
  for (let col = -1; col <= 1; col++) {
    for (let row = -1; row <= 1; row++) {
      const east = col * PIXEL_M;
      const north = -row * PIXEL_M;
      // Height falls along the facing direction.
      win.push(1000 - drop * (east * Math.sin(a) + north * Math.cos(a)));
    }
  }
  return win;
}

const sectors = (...on: number[]) => Array.from({ length: 8 }, (_, i) => on.includes(i));

describe("slope and aspect from heights", () => {
  it.each([
    [20, 0],
    [25, 90],
    [32, 135],
    [18, 180],
    [40, 270],
    [12, 315],
  ])("reads a %s° slope facing %s°", (deg, aspect) => {
    const r = slopeAspect(plane(deg, aspect), PIXEL_M);
    expect(r.slope).toBeCloseTo(deg, 5);
    expect(r.aspect).toBeCloseTo(aspect, 5);
  });

  it("has no aspect on flat ground", () => {
    expect(slopeAspect(new Array(9).fill(500), PIXEL_M)).toEqual({ slope: 0, aspect: null });
  });

  it("puts aspects in 45° sectors around their direction", () => {
    expect(sectorOf(0)).toBe(0);
    expect(sectorOf(22)).toBe(0);
    expect(sectorOf(23)).toBe(1);
    expect(sectorOf(350)).toBe(0);
    expect(sectorOf(200)).toBe(4);
    expect(sectorOf(300)).toBe(7);
  });
});

describe("which ground is marked", () => {
  const ne_se: TerrainFilter = { min: 20, max: 30, sectors: sectors(1, 2, 3) };

  it("marks ground inside both ranges only", () => {
    expect(matchesTerrain(ne_se, 25, 90)).toBe(true);
    expect(matchesTerrain(ne_se, 20, 45)).toBe(true);
    expect(matchesTerrain(ne_se, 30, 90)).toBe(false);
    expect(matchesTerrain(ne_se, 19.9, 90)).toBe(false);
    expect(matchesTerrain(ne_se, 25, 180)).toBe(false);
    expect(matchesTerrain(ne_se, 25, null)).toBe(false);
  });

  it("ignores the aspect when every direction is chosen", () => {
    expect(matchesTerrain(DEFAULT_FILTER, 20, null)).toBe(true);
    expect(matchesTerrain(DEFAULT_FILTER, 26, 10)).toBe(false);
  });

  it("marks nothing without a direction", () => {
    expect(matchesTerrain({ min: 0, max: 60, sectors: sectors() }, 25, 90)).toBe(false);
  });

  it("keeps the lower limit below the upper one", () => {
    expect(withRange({ ...DEFAULT_FILTER, min: 15, max: 25 }, "min", 30)).toMatchObject({ min: 30, max: 35 });
    expect(withRange({ ...DEFAULT_FILTER, min: 15, max: 25 }, "max", 10)).toMatchObject({ min: 5, max: 10 });
    expect(withRange(DEFAULT_FILTER, "max", 99).max).toBe(60);
    expect(withRange(DEFAULT_FILTER, "min", 60)).toMatchObject({ min: 55, max: 60 });
  });
});

describe("direction summary", () => {
  const sectorSummary = (on: boolean[]) => summary(on).replace(/\u2060/g, "");
  it("names runs of neighbouring directions", () => {
    expect(sectorSummary(sectors(1, 2, 3))).toBe("NO–SO");
    expect(sectorSummary(sectors(7, 0, 1))).toBe("NV–NO");
    expect(sectorSummary(sectors(0, 2, 3, 4))).toBe("N, O–S");
    expect(sectorSummary(sectors(5))).toBe("SV");
    expect(sectorSummary(sectors(0, 1, 2, 3, 4, 5, 6, 7))).toBe("alla väderstreck");
    expect(sectorSummary(sectors())).toBe("inget väderstreck");
  });
});

describe("from today's forecast", () => {
  const problem = (aspects: string[]) => ({ aspects }) as never;
  const forecast = (status: string, problems: unknown[]) => ({ regionId: "x", status, problems }) as never;

  it("takes the problems' aspects on ground of 30° and steeper", () => {
    const filter = forecastFilter(forecast("published", [problem(["NO", "O"]), problem(["O", "SO"])]));
    expect(filter).toEqual({ min: 30, max: 60, sectors: sectors(1, 2, 3) });
    expect(matchesTerrain(filter!, 72, 90)).toBe(true); // the top of the scale includes steeper ground
    expect(matchesTerrain(filter!, 29, 90)).toBe(false);
  });

  it("counts a problem without aspects as all of them", () => {
    expect(forecastFilter(forecast("published", [problem(["N"]), problem([])]))?.sectors).toEqual(sectors(0, 1, 2, 3, 4, 5, 6, 7));
  });

  it("gives nothing without a published forecast with problems", () => {
    expect(forecastFilter(forecast("season-over", [problem(["N"])]))).toBeNull();
    expect(forecastFilter(forecast("published", []))).toBeNull();
    expect(forecastFilter(null)).toBeNull();
  });

  it("finds the area in the middle of the map, not far away", () => {
    const areas = [{ id: "kebne", lat: 67.9, lon: 18.55 }, { id: "riks", lat: 68.42, lon: 18.13 }];
    expect(nearestArea(67.95, 18.4, areas)?.id).toBe("kebne");
    expect(nearestArea(59.3, 18.0, areas)).toBeNull();
  });
});
