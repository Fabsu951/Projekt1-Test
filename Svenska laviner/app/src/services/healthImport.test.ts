import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryWorkouts, createTour, fetchImportedSources } = vi.hoisted(() => ({
  queryWorkouts: vi.fn(),
  createTour: vi.fn(),
  fetchImportedSources: vi.fn(),
}));
vi.mock("capacitor-health", () => ({ Health: { queryWorkouts } }));
vi.mock("./tourService", () => ({ createTour, fetchImportedSources }));

import { checkForNewWorkouts, defaultTitle, findNewWorkouts, setAutoImport, toHealthWorkout } from "./healthImport";

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

describe("finding and importing new sessions", () => {
  const ski = { ...base, id: "ski-1", workoutType: "SKIING", route: route(50) };
  const run = { ...base, id: "run-1", workoutType: "RUNNING", route: route(50), startDate: "2027-02-04T07:00:00Z" };

  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    queryWorkouts.mockReset().mockResolvedValue({ workouts: [ski, run] });
    createTour.mockReset().mockImplementation(async (_t, tour) => ({ id: 7, title: tour.title }));
    fetchImportedSources.mockReset().mockResolvedValue([]);
  });

  it("leaves out sessions already imported on another phone", async () => {
    fetchImportedSources.mockResolvedValue(["hc:ski-1"]);
    expect((await findNewWorkouts("token")).map((w) => w.id)).toEqual(["run-1"]);
  });

  it("only lists, without importing, while automatic import is off", async () => {
    const r = await checkForNewWorkouts("token");
    expect(r).toEqual({ imported: [], waiting: 2 });
    expect(createTour).not.toHaveBeenCalled();
  });

  it("adds ski sessions as private tours when automatic import is on, and leaves runs waiting", async () => {
    await setAutoImport(true);
    const r = await checkForNewWorkouts("token");
    expect(r.imported).toHaveLength(1);
    expect(r.waiting).toBe(1);
    expect(createTour).toHaveBeenCalledWith("token", expect.objectContaining({ visibility: "private", sourceRef: "hc:ski-1", title: "Skidtur 3 februari" }));
    // Imported once: not offered again.
    expect((await findNewWorkouts("token")).map((w) => w.id)).toEqual(["run-1"]);
  });
});
