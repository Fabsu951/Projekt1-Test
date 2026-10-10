import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSnowDepth, summarizeDepth } from "./snowDepthService";

const now = new Date(Date.UTC(2027, 1, 14, 9));
const day = (d: number) => Date.UTC(2027, 1, d, 6);

describe("snow depth from SMHI stations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gives the latest depth in cm and the change over three days", () => {
    const values = [
      { date: day(10), value: "0.30" },
      { date: day(11), value: "0.37" },
      { date: day(12), value: "0.40" },
      { date: day(13), value: "0.41" },
      { date: day(14), value: "0.45" },
    ];
    expect(summarizeDepth(values, now)).toEqual({ depthCm: 45, measuredAt: new Date(day(14)).toISOString(), changeCm: 8 });
  });

  it("shows nothing old, and no change without a value three days earlier", () => {
    expect(summarizeDepth([{ date: day(9), value: "0.5" }], now)).toBeNull();
    expect(summarizeDepth([{ date: day(14), value: "0.12" }], now)).toMatchObject({ depthCm: 12, changeCm: null });
    expect(summarizeDepth([{ date: day(14), value: "x" }], now)).toBeNull();
  });

  it("uses the nearest active stations within 60 km that have a fresh value", async () => {
    const station = (id: number, lat: number, active = true) => ({ id, name: `S${id}`, latitude: lat, longitude: 18.5, height: 400, active });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/parameter/8.json")) {
        return new Response(JSON.stringify({ station: [station(1, 67.95), station(2, 68.0), station(3, 67.92, false), station(4, 70)] }));
      }
      const id = Number(/station\/(\d+)/.exec(url)![1]);
      const value = id === 2 ? [{ date: day(1), value: "0.9" }] : [{ date: day(14), value: "0.6" }];
      return new Response(JSON.stringify({ value }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const stations = await fetchSnowDepth(67.9, 18.5, now);
    expect(stations.map((s) => s.id)).toEqual([1]);
    expect(stations[0]).toMatchObject({ name: "S1", heightM: 400, depthCm: 60 });
    expect(stations[0].distanceKm).toBeLessThan(10);
  });
});
