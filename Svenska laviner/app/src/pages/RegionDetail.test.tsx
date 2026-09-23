import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegionDetail from "./RegionDetail";
import type { WeatherPoint } from "../types/weather";

const { mockWeather } = vi.hoisted(() => ({ mockWeather: vi.fn() }));

vi.mock("../services/weatherService", () => ({ fetchWeather: mockWeather }));
vi.mock("../services/avalancheService", () => ({
  fetchForecast: vi.fn().mockResolvedValue(null),
}));
vi.mock("../services/windStationService", () => ({
  findNearestWindStation: vi.fn().mockRejectedValue(new Error("offline")),
  fetchStationWindSeries: vi.fn(),
}));

function hour(i: number, windSpeed: number, windDirection: number): WeatherPoint {
  return {
    time: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    temperature: -5,
    windSpeed,
    windGust: windSpeed,
    windDirection,
    precipitation: 0,
    visibility: 10,
    symbol: 1,
  };
}

describe("RegionDetail forecast wind rose", () => {
  it("shows loading from the same forecast the weather table displays", async () => {
    // Values from a user-reported screenshot where the weather table showed
    // 13 and 11 m/s but the forecast rose reportedly showed no wind:
    // 13 V, 11 V, 7 V, 4 VSV, 3 SSV, 3 SV (the table shows every 3rd hour).
    const shown: [number, number][] = [
      [13, 270],
      [11, 270],
      [7, 270],
      [4, 247.5],
      [3, 202.5],
      [3, 225],
    ];
    const series: WeatherPoint[] = [];
    shown.forEach(([speed, dir], i) => {
      for (let k = 0; k < 3; k++) series.push(hour(i * 3 + k, speed, dir));
    });
    mockWeather.mockResolvedValue(series);

    render(
      <MemoryRouter initialEntries={["/omrade/sodra-jamtlandsfjallen"]}>
        <Routes>
          <Route path="/omrade/:id" element={<RegionDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const heading = await screen.findByRole("heading", { name: "Prognos, kommande timmar" });
    const subsection = heading.closest(".wind-subsection") as HTMLElement;
    // Westerly wind loads east-facing (lee) slopes.
    expect(within(subsection).getByText("Vind från V → mest vindlastat: O-vända sluttningar.")).toBeInTheDocument();
    const eastRow = within(subsection).getByRole("row", { name: /^O / });
    expect(eastRow).toHaveTextContent("9");
  });
});
