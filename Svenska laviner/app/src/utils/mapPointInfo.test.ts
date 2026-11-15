import { describe, expect, it } from "vitest";
import { describeTerrain, weatherNow } from "./mapPointInfo";
import type { WeatherPoint } from "../types/weather";

const wp = (time: string, temperature: number): WeatherPoint => ({
  time, temperature, windSpeed: 5, windGust: 8, windDirection: 270, precipitation: 0, visibility: 30, symbol: 1,
});

describe("describeTerrain", () => {
  it("names the slope and the way it faces", () => {
    expect(describeTerrain({ elevation: 1200, slope: 32.4, aspect: 44 })).toBe("Lutning 32°, sluttar mot NO");
  });
  it("calls gentle or aspect-less ground flat", () => {
    expect(describeTerrain({ elevation: 900, slope: 1.2, aspect: null })).toBe("Flack mark");
    expect(describeTerrain({ elevation: 900, slope: 2.4, aspect: 180 })).toBe("Flack mark");
  });
});

describe("weatherNow", () => {
  it("picks the forecast step nearest now", () => {
    const now = Date.parse("2026-12-20T10:20:00Z");
    const steps = [wp("2026-12-20T09:00:00Z", -3), wp("2026-12-20T10:00:00Z", -4), wp("2026-12-20T11:00:00Z", -5)];
    expect(weatherNow(steps, now)?.temperature).toBe(-4);
  });
  it("is null without steps", () => {
    expect(weatherNow([])).toBeNull();
  });
});
