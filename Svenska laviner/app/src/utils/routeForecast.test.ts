import { describe, expect, it } from "vitest";
import type { AvalancheForecast, ForecastProblem } from "../types/avalanche";
import type { RouteSample } from "./routePlan";
import { checkRouteAgainstForecast, elevationBands, regionForRoute, sectorOf } from "./routeForecast";

const problem = (over: Partial<ForecastProblem> = {}): ForecastProblem => ({
  type: "vindpack",
  name: "Drevsnöflak",
  aspects: ["NO", "O"],
  elevations: ["kalfjall"],
  metersAbove: null,
  metersBelow: null,
  sensitivity: null,
  size: null,
  where: null,
  infoUrl: null,
  ...over,
});

const forecast = (problems: ForecastProblem[]): AvalancheForecast => ({
  regionId: "kebnekaisefjallen", // treeline taken as 650 m
  status: "published",
  dangerLevel: 3,
  problems,
  headline: null,
  mainMessage: null,
  publishedText: null,
  sourceUrl: "https://www.lavinprognoser.se",
});

/** 25 m samples: [elevation, slope, aspect] per step. */
function route(steps: Array<[number, number, number | null]>): RouteSample[] {
  return steps.map(([elevation, slope, aspect], i) => ({ lat: 67.9, lon: 18.5, distM: i * 25, elevation, slope, aspect }));
}

describe("route vs. today's forecast", () => {
  it("names compass sectors from aspects", () => {
    expect([0, 22, 23, 45, 90, 180, 270, 337, 359].map(sectorOf)).toEqual(["N", "N", "NO", "NO", "O", "S", "V", "NV", "N"]);
  });

  it("puts heights in bands around the treeline, overlapping near the edges", () => {
    expect(elevationBands(1200, 650)).toEqual(["kalfjall"]);
    expect(elevationBands(720, 650)).toEqual(["kalfjall", "tradgrans"]);
    expect(elevationBands(650, 650)).toEqual(["tradgrans"]);
    expect(elevationBands(400, 650)).toEqual(["under_tradgrans"]);
  });

  it("flags steep ground in the problem's aspects and heights only", () => {
    const samples = route([
      [1000, 10, 45], // start
      [1000, 35, 45], // steep, NO, kalfjäll → match
      [1025, 35, 90], // steep, O → match
      [1050, 35, 180], // steep but S → no
      [1075, 20, 45], // NO but not steep → no
      [500, 35, 45], // steep NO but under the treeline → no
    ]);
    const check = checkRouteAgainstForecast(samples, forecast([problem()]));
    expect(check.problems[0].lengthM).toBe(50);
    expect(check.problems[0].sectors).toEqual(["NO", "O"]);
    expect(check.problems[0].bands).toEqual(["kalfjall"]);
    expect(check.flagged).toEqual([false, true, true, false, false, false]);
    expect(check.steepM).toBe(100);
  });

  it("uses the forecaster's metre limits when given", () => {
    const samples = route([[900, 10, 0], [900, 35, 45], [1300, 35, 45]]);
    const check = checkRouteAgainstForecast(samples, forecast([problem({ metersAbove: 1200 })]));
    expect(check.flagged).toEqual([false, false, true]);
  });

  it("treats a problem without listed aspects or heights as everywhere", () => {
    const samples = route([[900, 10, 0], [400, 33, 200]]);
    const check = checkRouteAgainstForecast(samples, forecast([problem({ aspects: [], elevations: [] })]));
    expect(check.problems[0].lengthM).toBe(25);
  });

  it("finds the forecast area around the middle of the route", () => {
    const regions = [
      { id: "kebnekaisefjallen", lat: 67.9, lon: 18.55 },
      { id: "sodra-jamtlandsfjallen", lat: 63.4, lon: 13.08 },
    ];
    expect(regionForRoute(route([[0, 0, null], [0, 0, null]]), regions)).toBe("kebnekaisefjallen");
    expect(regionForRoute([{ lat: 59.33, lon: 18.07, distM: 0, elevation: 0, slope: 0, aspect: null }], regions)).toBeNull();
  });
});
