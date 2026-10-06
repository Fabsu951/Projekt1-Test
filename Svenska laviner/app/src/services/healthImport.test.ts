import { describe, expect, it, vi } from "vitest";

vi.mock("capacitor-health", () => ({ Health: {} }));

import { defaultTitle, toHealthWorkout } from "./healthImport";

function route(n: number, stepDeg = 0.001) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(Date.UTC(2027, 1, 3, 9, i)).toISOString(),
    lat: 67.9 + i * stepDeg,
    lng: 18.5,
    alt: 800 + i,
  }));
}

const base = {
  startDate: "2027-02-03T09:00:00Z",
  endDate: "2027-02-03T12:00:00Z",
  sourceName: "",
  sourceBundleId: "com.garmin.android.apps.connectmobile",
  duration: 10800,
  calories: 0,
};

describe("toHealthWorkout", () => {
  it("turns a session with a route into track points, with time and height", () => {
    const w = toHealthWorkout({ ...base, id: "a", workoutType: "SKIING", route: route(50) })!;
    expect(w.label).toBe("Skidtur");
    expect(w.suggested).toBe(true);
    expect(w.points[0]).toEqual([67.9, 18.5, 800, Date.UTC(2027, 1, 3, 9, 0)]);
    expect(w.distanceM).toBeGreaterThan(5000);
    expect(defaultTitle(w)).toBe("Skidtur 3 februari");
  });

  it("skips sessions without a usable route", () => {
    expect(toHealthWorkout({ ...base, id: "b", workoutType: "SKIING" })).toBeNull();
    expect(toHealthWorkout({ ...base, id: "c", workoutType: "SKIING", route: route(5) })).toBeNull();
    // Standing still: plenty of points, no distance.
    expect(toHealthWorkout({ ...base, id: "d", workoutType: "SKIING", route: route(100, 0) })).toBeNull();
  });

  it("doesn't preselect runs in town", () => {
    const w = toHealthWorkout({ ...base, id: "e", workoutType: "RUNNING", route: route(50) })!;
    expect(w.label).toBe("Löpning");
    expect(w.suggested).toBe(false);
  });
});
