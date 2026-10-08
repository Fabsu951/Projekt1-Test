import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryWorkouts, createTour, fetchImportedSources, requestRoute } = vi.hoisted(() => ({
  queryWorkouts: vi.fn(),
  createTour: vi.fn(),
  fetchImportedSources: vi.fn(),
  requestRoute: vi.fn(),
}));
vi.mock("capacitor-health", () => ({ Health: { queryWorkouts } }));
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capacitor/core")>()),
  registerPlugin: () => ({ requestRoute }),
}));
vi.mock("./tourService", () => ({ createTour, fetchImportedSources }));

import { checkForNewWorkouts, defaultTitle, findNewWorkouts, permissionGranted, requestWorkoutRoute, scanWorkouts, setAutoImport, toHealthWorkout, altitudeOf } from "./healthImport";

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
  it("understands Apple Hälsa's type names as well as Health Connect's", () => {
    const of = (workoutType: string) => toHealthWorkout({ ...base, id: workoutType, workoutType, route: route(50) })!;
    expect(of("downhillSkiing")).toMatchObject({ label: "Skidtur", suggested: true });
    expect(of("crossCountrySkiing")).toMatchObject({ label: "Längdskidor", suggested: true });
    expect(of("snowboarding")).toMatchObject({ label: "Snowboard", suggested: true });
    expect(of("running")).toMatchObject({ label: "Löpning", suggested: false });
    expect(of("MOUNTAIN_BIKING")).toMatchObject({ label: "Mountainbike", suggested: false });
    expect(of("other")).toMatchObject({ label: "Pass", suggested: true });
  });

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

  it("counts new sessions that came without a GPS route", async () => {
    const noRoute = { ...base, id: "walk-1", workoutType: "WALKING" };
    queryWorkouts.mockResolvedValue({ workouts: [ski, run, noRoute] });
    const r = await scanWorkouts("token");
    expect(r.workouts.map((w) => w.id)).toEqual(["run-1", "ski-1"]);
    expect(r.withoutRoute).toEqual([
      expect.objectContaining({ id: "walk-1", label: "Promenad", canAsk: true, suggested: false }),
    ]);
  });

  it("turns a route fetched for one session into an importable workout", async () => {
    const walk = { id: "walk-1", type: "SKIING", label: "Skidtur", startDate: base.startDate, endDate: base.endDate, distanceM: null, suggested: true, canAsk: true };
    requestRoute.mockResolvedValueOnce({ granted: true, route: route(50) });
    expect(await requestWorkoutRoute(walk)).toMatchObject({ id: "walk-1", label: "Skidtur", suggested: true });
    expect(requestRoute).toHaveBeenCalledWith({ id: "walk-1" });
    requestRoute.mockResolvedValueOnce({ granted: false, route: [] });
    expect(await requestWorkoutRoute(walk)).toBeNull();
    requestRoute.mockClear();
    expect(await requestWorkoutRoute({ ...walk, canAsk: false })).toBeNull();
    expect(requestRoute).not.toHaveBeenCalled();
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

describe("permissionGranted", () => {
  it("reads the object the Android and iOS plugin code actually returns", () => {
    const res = { permissions: { READ_WORKOUTS: true, READ_ROUTE: false } };
    expect(permissionGranted(res, "READ_WORKOUTS")).toBe(true);
    expect(permissionGranted(res, "READ_ROUTE")).toBe(false);
  });

  it("also reads the list shape from the plugin's types", () => {
    const res = { permissions: [{ READ_WORKOUTS: false }, { READ_ROUTE: true }] };
    expect(permissionGranted(res, "READ_ROUTE")).toBe(true);
    expect(permissionGranted(res, "READ_WORKOUTS")).toBe(false);
  });

  it("treats a missing or odd answer as not granted", () => {
    expect(permissionGranted({}, "READ_ROUTE")).toBe(false);
    expect(permissionGranted(null, "READ_ROUTE")).toBe(false);
    expect(permissionGranted({ permissions: "yes" }, "READ_ROUTE")).toBe(false);
  });
});

describe("altitudeOf", () => {
  it("reads numbers and Health Connect's Length text, nothing else", () => {
    expect(altitudeOf(812.4)).toBe(812.4);
    expect(altitudeOf("812.4 meters")).toBe(812.4);
    expect(altitudeOf("-3 m")).toBe(-3);
    expect(altitudeOf("2600 feet")).toBeNull();
    expect(altitudeOf(null)).toBeNull();
    expect(altitudeOf(Number.NaN)).toBeNull();
  });
});
