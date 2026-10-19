import { describe, expect, it } from "vitest";
import { areaImage, overviewImage } from "./shareImage";
import { REGIONS } from "../data/regions";
import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";

const now = new Date("2027-02-15T09:00:00Z");
const region = REGIONS[0];

function forecast(regionId: string, status: ForecastStatus, level: 1 | 2 | 3 | 4 | 5 | null): AvalancheForecast {
  return {
    regionId,
    status,
    dangerLevel: level,
    problems:
      level === null
        ? []
        : [
            {
              type: "vindpack",
              name: "Drevsnöflak",
              aspects: ["N", "NO", "O"],
              elevations: ["kalfjall"],
              metersAbove: null,
              metersBelow: null,
              sensitivity: null,
              size: null,
              where: null,
              infoUrl: null,
            },
          ],
    headline: "Drevsnö på läsidor",
    mainMessage: null,
    publishedText: "14 februari 2027, 18:00",
    sourceUrl: "https://www.lavinprognoser.se/",
  };
}

describe("areaImage", () => {
  it("draws a published level with its problems and publication time", () => {
    const m = areaImage(region, forecast(region.id, "published", 3), false, now);
    expect(m).toMatchObject({ kind: "area", areaName: region.name, level: 3, label: "Betydande fara", publishedText: "14 februari 2027, 18:00" });
    expect(m?.dateLine).toBe("Lavinprognos måndag 15 februari");
    expect(m?.problems).toEqual([{ name: "Drevsnöflak", where: "N/NO/O, kalfjället" }]);
  });

  it("never makes an image without a published level", () => {
    for (const status of ["season-over", "not-assessed", "spring", "no-danger", "unavailable"] as const) {
      expect(areaImage(region, forecast(region.id, status, null), false, now)).toBeNull();
    }
    expect(areaImage(region, null, false, now)).toBeNull();
  });

  it("never makes an image from a saved (offline) forecast", () => {
    expect(areaImage(region, forecast(region.id, "published", 2), true, now)).toBeNull();
  });
});

describe("overviewImage", () => {
  it("lists every area, with a level only where one is published", () => {
    const forecasts = Object.fromEntries(
      REGIONS.map((r, i) => [r.id, i === 0 ? forecast(r.id, "published", 4) : forecast(r.id, "not-assessed", null)]),
    );
    const m = overviewImage(REGIONS, forecasts, false, now);
    expect(m?.rows).toHaveLength(REGIONS.length);
    expect(m?.rows[0]).toEqual({ name: REGIONS[0].name, level: 4, label: "Stor fara" });
    expect(m?.rows[1]).toEqual({ name: REGIONS[1].name, level: null, label: "Ej bedömd" });
  });

  it("makes no image when nothing is published, or the forecasts are saved ones", () => {
    const none = Object.fromEntries(REGIONS.map((r) => [r.id, forecast(r.id, "season-over", null)]));
    expect(overviewImage(REGIONS, none, false, now)).toBeNull();
    const some = Object.fromEntries(REGIONS.map((r) => [r.id, forecast(r.id, "published", 2)]));
    expect(overviewImage(REGIONS, some, true, now)).toBeNull();
  });
});
