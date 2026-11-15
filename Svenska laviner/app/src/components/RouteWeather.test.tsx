import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import RouteWeather from "./RouteWeather";
import { pickSteps, routeEnds, weatherCell } from "../utils/mapPointInfo";
import type { WeatherPoint } from "../types/weather";
import type { RouteSample } from "../utils/routePlan";

vi.mock("../services/weatherService", () => ({ fetchWeatherSeries: vi.fn() }));
import { fetchWeatherSeries } from "../services/weatherService";

const wp = (time: string, temperature: number, extra: Partial<WeatherPoint> = {}): WeatherPoint => ({
  time, temperature, windSpeed: 6, windGust: 7, windDirection: 270, precipitation: 0, visibility: 30, symbol: 1, ...extra,
});

const sample = (lat: number, lon: number, elevation: number | null, distM = 0): RouteSample => ({
  lat, lon, distM, elevation, slope: 10, aspect: 90,
});

describe("routeEnds", () => {
  it("finds the highest and lowest point, skipping missing heights", () => {
    const ends = routeEnds([sample(68, 18, 600), sample(68.01, 18, null), sample(68.05, 18.1, 1500), sample(68.06, 18.1, 1400)]);
    expect(ends?.top).toEqual({ lat: 68.05, lon: 18.1, elevation: 1500 });
    expect(ends?.bottom).toEqual({ lat: 68, lon: 18, elevation: 600 });
  });
  it("is null with no heights at all", () => {
    expect(routeEnds([sample(68, 18, null)])).toBeNull();
  });
});

describe("pickSteps", () => {
  it("takes every third hour from now for a day", () => {
    const now = Date.parse("2026-12-20T10:10:00Z");
    const hourly = Array.from({ length: 40 }, (_, i) => wp(new Date(Date.parse("2026-12-20T08:00:00Z") + i * 3600e3).toISOString(), i));
    const times = pickSteps(hourly, now).map((p) => p.time.slice(11, 16));
    expect(times).toEqual(["10:00", "13:00", "16:00", "19:00", "22:00", "01:00", "04:00", "07:00", "10:00"]);
  });
});

describe("weatherCell", () => {
  it("shows gusts and precipitation only when they add something", () => {
    expect(weatherCell(wp("x", -7.6, { windSpeed: 11.6, windGust: 18.2, windDirection: 270, precipitation: 0.4 }))).toBe("-8°, 12 (18) m/s V, 0,4 mm/h");
    expect(weatherCell(wp("x", -2.2, { windSpeed: 4, windGust: 5, windDirection: 0 }))).toBe("-2°, 4 m/s N");
  });
});

describe("RouteWeather", () => {
  beforeEach(() => {
    vi.mocked(fetchWeatherSeries).mockReset();
  });

  it("asks SMHI for the top and the bottom and shows both", async () => {
    const soon = new Date(Date.now() + 10 * 60e3).toISOString();
    vi.mocked(fetchWeatherSeries).mockImplementation(async (lat) => [wp(soon, lat > 68.02 ? -9 : -3)]);
    render(<RouteWeather samples={[sample(68, 18, 600), sample(68.05, 18.1, 1500, 6000)]} />);
    expect(await screen.findByText("Toppen, 1 500 m, nu", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("Botten, 600 m, nu")).toBeInTheDocument();
    expect(screen.getAllByText("-9°, 6 m/s V").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-3°, 6 m/s V").length).toBeGreaterThan(0);
    expect(fetchWeatherSeries).toHaveBeenCalledTimes(2);
  });

  it("asks once when top and bottom share an SMHI square", async () => {
    const soon = new Date(Date.now() + 10 * 60e3).toISOString();
    vi.mocked(fetchWeatherSeries).mockResolvedValue([wp(soon, -4)]);
    render(<RouteWeather samples={[sample(68, 18, 600), sample(68.005, 18.005, 750, 700)]} />);
    expect(await screen.findByText("Väder längs rutten")).toBeInTheDocument();
    expect((await screen.findAllByText("-4°, 6 m/s V", {}, { timeout: 2000 })).length).toBeGreaterThan(0);
    expect(fetchWeatherSeries).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait for ever on an empty answer", async () => {
    vi.mocked(fetchWeatherSeries).mockResolvedValue([]);
    render(<RouteWeather samples={[sample(68, 18, 600), sample(68.05, 18.1, 1500, 6000)]} />);
    expect(await screen.findByText("Vädret kunde inte hämtas just nu.", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("says so when SMHI can't be reached", async () => {
    vi.mocked(fetchWeatherSeries).mockImplementation(() => Promise.reject(new Error("offline")));
    render(<RouteWeather samples={[sample(68, 18, 600), sample(68.05, 18.1, 1500, 6000)]} />);
    // Waits out the component's 600 ms pause before it asks SMHI.
    await act(() => new Promise((r) => setTimeout(r, 900)));
    expect(screen.getByText("Vädret kunde inte hämtas just nu.")).toBeInTheDocument();
  });
});
