import { describe, expect, it } from "vitest";
import {
  computeWindLoading,
  mostLoadedSectors,
  oppositeSector,
  rawWindSummary,
  windFromDistribution,
} from "./windAnalysis";
import type { WeatherPoint } from "../types/weather";

function point(windSpeed: number, windDirection: number): WeatherPoint {
  return {
    time: "2026-01-01T00:00:00Z",
    temperature: -5,
    windSpeed,
    windGust: windSpeed + 2,
    windDirection,
    precipitation: 0,
    visibility: 10,
    symbol: 1,
  };
}

describe("computeWindLoading", () => {
  it("attributes loading to the sector opposite the wind's FROM direction", () => {
    // Wind from the north (0°) erodes north-facing slopes and loads the
    // south-facing (lee) slope.
    const loads = computeWindLoading([point(10, 0)]);
    const south = loads.find((l) => l.sector === "S")!;
    const north = loads.find((l) => l.sector === "N")!;
    expect(south.loadIndex).toBeGreaterThan(0);
    expect(north.loadIndex).toBe(0);
  });

  it("ignores wind below the transport threshold", () => {
    const loads = computeWindLoading([point(3, 90)]);
    expect(loads.every((l) => l.loadIndex === 0)).toBe(true);
  });

  it("accumulates loading across multiple hours in the same sector", () => {
    const loads = computeWindLoading([point(10, 0), point(12, 5), point(8, 355)]);
    const south = loads.find((l) => l.sector === "S")!;
    expect(south.hoursWithTransport).toBe(3);
    expect(south.loadIndex).toBeCloseTo(10 - 6 + (12 - 6) + (8 - 6), 5);
  });

  it("returns all 8 sectors even when there is no wind at all", () => {
    const loads = computeWindLoading([]);
    expect(loads).toHaveLength(8);
    expect(loads.every((l) => l.loadIndex === 0 && l.hoursWithTransport === 0)).toBe(true);
  });
});

describe("mostLoadedSectors", () => {
  it("returns sectors sorted by load, excluding zero-load sectors", () => {
    const loads = computeWindLoading([point(15, 0), point(10, 90)]);
    const top = mostLoadedSectors(loads, 2);
    expect(top).toHaveLength(2);
    expect(top[0].loadIndex).toBeGreaterThanOrEqual(top[1].loadIndex);
    expect(top.every((l) => l.loadIndex > 0)).toBe(true);
  });

  it("returns fewer than `count` when fewer sectors have any load", () => {
    const loads = computeWindLoading([point(10, 0)]);
    expect(mostLoadedSectors(loads, 3)).toHaveLength(1);
  });
});

describe("rawWindSummary", () => {
  it("returns null for an empty series", () => {
    expect(rawWindSummary([])).toBeNull();
  });

  it("picks the highest reading even when it's below the transport threshold", () => {
    const summary = rawWindSummary([point(1, 10), point(5.8, 220), point(3, 40)]);
    expect(summary).toEqual({ maxSpeed: 5.8, maxSpeedDirection: 220 });
  });
});

describe("windFromDistribution", () => {
  it("counts hours per FROM sector regardless of the transport threshold", () => {
    const dist = windFromDistribution([point(3, 130), point(5.8, 140), point(2, 270)]);
    expect(dist.find((d) => d.sector === "SO")!.hours).toBe(2);
    expect(dist.find((d) => d.sector === "V")!.hours).toBe(1);
  });

  it("ignores dead-calm readings whose direction is meaningless", () => {
    const dist = windFromDistribution([point(0.3, 90)]);
    expect(dist.every((d) => d.hours === 0)).toBe(true);
  });
});

describe("oppositeSector", () => {
  it("maps each sector to the one 180° away", () => {
    expect(oppositeSector("V")).toBe("O");
    expect(oppositeSector("NO")).toBe("SV");
  });
});
