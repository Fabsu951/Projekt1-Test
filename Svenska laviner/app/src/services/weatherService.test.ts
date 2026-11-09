import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWeather } from "./weatherService";

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

describe("fetchWeather", () => {
  it("parses the snow1g response shape (flat data object, renamed keys)", async () => {
    const response = {
      timeSeries: [
        {
          time: "2026-09-23T06:00:00Z",
          data: {
            air_temperature: -4.2,
            wind_speed: 5.1,
            wind_speed_of_gust: 9.3,
            wind_from_direction: 270,
            precipitation_amount_mean: 0.1,
            visibility: 40,
            symbol_code: 3,
          },
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));

    const [point] = await fetchWeather(67.9, 18.55);
    expect(point).toMatchObject({
      time: "2026-09-23T06:00:00Z",
      temperature: -4.2,
      windSpeed: 5.1,
      windGust: 9.3,
      windDirection: 270,
      precipitation: 0.1,
      visibility: 40,
      symbol: 3,
    });
  });

  it("throws with the status code when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));
    await expect(fetchWeather(67.9, 18.55)).rejects.toThrow("404");
  });
});

describe("snowfallOutlook", () => {
  const now = new Date("2026-11-09T13:30:00Z");
  const entry = (time: string, rate: number, frozen: number) => ({ time, data: { precipitation_amount_mean: rate, precipitation_frozen_part: frozen } });

  it("adds up snow over the next 24 h and 72 h, step lengths included", async () => {
    const { snowfallOutlook } = await import("./weatherService");
    const series = [
      entry("2026-11-09T13:00:00Z", 9, 100), // before now: not counted
      entry("2026-11-09T14:00:00Z", 1, 100), // 1 h × 1 mm/h
      entry("2026-11-09T15:00:00Z", 2, 50), // 1 h × 2 mm/h × 50 %
      entry("2026-11-09T16:00:00Z", 3, -9), // -9: no precipitation → nothing
      entry("2026-11-10T22:00:00Z", 0.5, 100), // 30 h after the step before: after 24 h, counted in 72 h only
      entry("2026-11-12T12:00:00Z", 0.1, 100), // 38 h × 0.1, within 72 h
      entry("2026-11-13T00:00:00Z", 5, 100), // after 72 h
    ];
    expect(snowfallOutlook(series, now)).toEqual({ next24hMm: 2, next72hMm: 20.8 });
  });

  it("gives nothing when the forecast doesn't reach three days", async () => {
    const { snowfallOutlook } = await import("./weatherService");
    expect(snowfallOutlook([entry("2026-11-09T14:00:00Z", 1, 100)], now)).toBeNull();
  });
});
