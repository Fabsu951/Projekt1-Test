import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegionList from "./RegionList";
import { REGIONS } from "../data/regions";
import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));

vi.mock("../services/avalancheService", () => ({ loadForecasts: mockLoad }));

function forecasts(status: ForecastStatus, dangerLevel: AvalancheForecast["dangerLevel"]) {
  const byId: Record<string, AvalancheForecast> = {};
  for (const r of REGIONS) {
    byId[r.id] = {
      regionId: r.id,
      status,
      dangerLevel,
      problems: [],
      headline: null,
    mainMessage: null,
      publishedText: null,
      sourceUrl: "https://www.lavinprognoser.se/",
    };
  }
  return { byId, stale: false, cachedAt: null };
}

function renderList() {
  render(
    <MemoryRouter>
      <RegionList />
    </MemoryRouter>
  );
}

describe("RegionList", () => {
  it("renders a card for every region with its danger level once loaded", async () => {
    mockLoad.mockResolvedValue(forecasts("published", 2));
    renderList();

    for (const region of REGIONS) {
      expect(screen.getByText(region.name)).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getAllByText(/Måttlig fara/)).toHaveLength(REGIONS.length);
    });
  });

  it("shows 'Säsongen slut' and a season notice instead of any danger level off-season", async () => {
    mockLoad.mockResolvedValue(forecasts("season-over", null));
    renderList();

    await waitFor(() => {
      expect(screen.getAllByText("Säsongen slut")).toHaveLength(REGIONS.length);
    });
    expect(screen.getByText(/Prognossäsongen är slut/)).toBeInTheDocument();
    expect(screen.queryByText(/fara/)).not.toBeInTheDocument();
  });
});
