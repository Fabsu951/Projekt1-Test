import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesProvider from "../favorites/FavoritesProvider";
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
  return render(
    <FavoritesProvider>
      <MemoryRouter>
        <RegionList />
      </MemoryRouter>
    </FavoritesProvider>
  );
}

describe("RegionList", () => {
  beforeEach(() => localStorage.clear());

  it("puts starred regions under Mina områden and remembers them", async () => {
    mockLoad.mockResolvedValue(forecasts("published", 2));
    const first = renderList();
    expect(screen.queryByRole("heading", { name: "Mina områden" })).not.toBeInTheDocument();

    const kebnekaise = REGIONS.find((r) => r.id === "kebnekaisefjallen")!;
    fireEvent.click(screen.getByRole("button", { name: `Spara ${kebnekaise.name} i mina områden` }));

    const mine = screen.getByRole("heading", { name: "Mina områden" }).nextElementSibling as HTMLElement;
    expect(within(mine).getByText(kebnekaise.name)).toBeInTheDocument();
    expect(within(mine).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: `Ta bort ${kebnekaise.name} från mina områden` })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Still starred after the app is reopened.
    first.unmount();
    renderList();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Mina områden" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: `Ta bort ${kebnekaise.name} från mina områden` }));
    expect(screen.queryByRole("heading", { name: "Mina områden" })).not.toBeInTheDocument();
  });

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
