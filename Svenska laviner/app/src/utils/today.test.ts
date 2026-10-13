import { describe, expect, it } from "vitest";
import { problemWhere, recentDays, swedishDate, trendSinceYesterday } from "./today";
import type { ForecastProblem } from "../types/avalanche";

const now = new Date("2027-02-05T10:00:00Z");
const history = [
  { date: "2027-02-03", dangerLevel: 2 as const },
  { date: "2027-02-04", dangerLevel: 2 as const },
  { date: "2027-02-05", dangerLevel: 3 as const },
  { date: "2027-02-06", dangerLevel: 3 as const },
];

describe("today helpers", () => {
  it("uses Swedish dates, even just after midnight", () => {
    expect(swedishDate(new Date("2027-02-04T23:30:00Z"))).toBe("2027-02-05");
  });

  it("leaves tomorrow's forecast out of the recent days", () => {
    expect(recentDays(history, now).map((d) => d.date)).toEqual(["2027-02-03", "2027-02-04", "2027-02-05"]);
  });

  it("compares today with yesterday, and says nothing without both", () => {
    expect(trendSinceYesterday(history, 3, now)).toEqual({ kind: "up", from: 2 });
    expect(trendSinceYesterday(history, 2, now)).toEqual({ kind: "same", from: 2 });
    expect(trendSinceYesterday(history, null, now)).toBeNull();
    expect(trendSinceYesterday([], 3, now)).toBeNull();
  });

  it("summarises where a problem is", () => {
    const p: ForecastProblem = { type: null, name: "Drevsnöflak", aspects: ["S", "O"], elevations: ["kalfjall"], metersAbove: null, metersBelow: null, sensitivity: null, size: null, where: null, infoUrl: null };
    expect(problemWhere(p)).toBe("O/S, kalfjället");
    expect(problemWhere({ ...p, aspects: ["N", "NO", "O", "SO", "S", "SV", "V", "NV"], metersAbove: 800 })).toBe("alla väderstreck, över 800 m");
  });
});
