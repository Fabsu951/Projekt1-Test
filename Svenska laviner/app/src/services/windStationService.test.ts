import { afterEach, describe, expect, it, vi } from "vitest";
import { findNearestWindStation, fetchStationWindSeries } from "./windStationService";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findNearestWindStation", () => {
  it("picks the closest active station by haversine distance", async () => {
    const stations = {
      station: [
        { id: 1, name: "Far away", latitude: 59.3, longitude: 18.0, active: true },
        { id: 2, name: "Close by", latitude: 63.41, longitude: 13.09, active: true },
        { id: 3, name: "Medium", latitude: 65.0, longitude: 15.0, active: true },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(stations)));

    const result = await findNearestWindStation(63.4, 13.08);
    expect(result.id).toBe(2);
    expect(result.name).toBe("Close by");
    expect(result.distanceKm).toBeLessThan(5);
  });

  it("ignores stations explicitly marked inactive", async () => {
    const stations = {
      station: [
        { id: 1, name: "Inactive but closest", latitude: 63.4, longitude: 13.08, active: false },
        { id: 2, name: "Active", latitude: 65.0, longitude: 15.0, active: true },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(stations)));

    const result = await findNearestWindStation(63.4, 13.08);
    expect(result.id).toBe(2);
  });

  it("throws when the station list request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false, 503)));
    await expect(findNearestWindStation(63.4, 13.08)).rejects.toThrow("503");
  });
});

describe("fetchStationWindSeries", () => {
  it("zips matching timestamps from the speed and direction series", async () => {
    const speeds = { value: [{ date: 1000, value: "5" }, { date: 2000, value: "7" }] };
    const directions = { value: [{ date: 1000, value: "180" }, { date: 2000, value: "270" }] };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/parameter/4/")) return Promise.resolve(jsonResponse(speeds));
      if (url.includes("/parameter/3/")) return Promise.resolve(jsonResponse(directions));
      throw new Error("unexpected url: " + url);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStationWindSeries(12345);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ windSpeed: 5, windDirection: 180 });
    expect(result[1]).toMatchObject({ windSpeed: 7, windDirection: 270 });
  });

  it("drops timestamps present in only one of the two series", async () => {
    const speeds = { value: [{ date: 1000, value: "5" }, { date: 2000, value: "7" }] };
    const directions = { value: [{ date: 1000, value: "180" }] };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/parameter/4/")) return Promise.resolve(jsonResponse(speeds));
      return Promise.resolve(jsonResponse(directions));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStationWindSeries(12345);
    expect(result).toHaveLength(1);
    expect(result[0].windSpeed).toBe(5);
  });
});
