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
