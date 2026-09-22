import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./geo";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceKm({ lat: 63.4, lon: 13.08 }, { lat: 63.4, lon: 13.08 })).toBe(0);
  });

  it("computes a roughly correct distance between two known cities", () => {
    // Stockholm to Gothenburg is ~400 km as the crow flies.
    const stockholm = { lat: 59.33, lon: 18.07 };
    const gothenburg = { lat: 57.71, lon: 11.97 };
    const distance = haversineDistanceKm(stockholm, gothenburg);
    expect(distance).toBeGreaterThan(370);
    expect(distance).toBeLessThan(430);
  });

  it("is symmetric", () => {
    const a = { lat: 68.42, lon: 18.13 };
    const b = { lat: 62.78, lon: 12.8 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 6);
  });
});
