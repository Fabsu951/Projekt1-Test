import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesProvider from "../favorites/FavoritesProvider";
import TodayPage from "./TodayPage";
import { REGIONS } from "../data/regions";
import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";

const { mockLoad, mockHistory, mockObservations } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockHistory: vi.fn(),
  mockObservations: vi.fn(),
}));

vi.mock("../services/avalancheService", () => ({ loadForecasts: mockLoad, fetchForecastHistory: mockHistory }));
vi.mock("../services/observationService", () => ({ fetchObservations: mockObservations }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null, token: null }) }));

function forecasts(status: ForecastStatus, dangerLevel: AvalancheForecast["dangerLevel"]) {
  const byId: Record<string, AvalancheForecast> = {};
  for (const r of REGIONS) {
    byId[r.id] = {
      regionId: r.id,
      status,
      dangerLevel,
      problems: [],
      headline: dangerLevel ? `Rubrik för ${r.name}` : null,
      mainMessage: null,
      publishedText: dangerLevel ? "5 februari 2027, 08:00" : null,
      sourceUrl: "https://www.lavinprognoser.se/",
    };
  }
  return { byId, stale: false, cachedAt: null };
}

function renderPage() {
  return render(
    <FavoritesProvider>
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>
    </FavoritesProvider>
  );
}

const kebnekaise = REGIONS.find((r) => r.id === "kebnekaisefjallen")!;

describe("TodayPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("fjallkoll:welcome-done", "1");
    mockHistory.mockResolvedValue([]);
    mockObservations.mockResolvedValue([]);
  });

  it("moves a starred area up to Mina områden with today's forecast, and remembers it", async () => {
    mockLoad.mockResolvedValue(forecasts("published", 3));
    const first = renderPage();
    expect(await screen.findByText(/Tryck på/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Spara ${kebnekaise.name} i mina områden` }));
    const mine = screen.getByRole("heading", { name: "Mina områden" }).closest("section")!;
    expect(within(mine).getByRole("link", { name: kebnekaise.name })).toHaveAttribute("href", `/omrade/${kebnekaise.id}`);
    expect(within(mine).getByText(`Rubrik för ${kebnekaise.name}`)).toBeInTheDocument();
    expect(within(mine).getByText("Betydande fara")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Övriga områden" })).toBeInTheDocument();

    first.unmount();
    renderPage();
    const again = (await screen.findByRole("heading", { name: "Mina områden" })).closest("section")!;
    await waitFor(() => expect(within(again).getByRole("link", { name: kebnekaise.name })).toBeInTheDocument());
  });

  it("lists every area with its danger level and shows when the forecast was published", async () => {
    mockLoad.mockResolvedValue(forecasts("published", 2));
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Måttlig fara/)).toHaveLength(REGIONS.length));
    expect(screen.getByText(/prognosen publicerad 5 februari 2027, 08:00/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Översiktskarta över prognosområdena" })).toBeInTheDocument();
  });

  it("never shows a danger level off-season, and says when forecasts start", async () => {
    mockLoad.mockResolvedValue(forecasts("season-over", null));
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Utanför säsong")).toHaveLength(REGIONS.length));
    expect(screen.getByText("Ingen lavinprognos just nu.")).toBeInTheDocument();
    expect(screen.queryByText(/fara/)).not.toBeInTheDocument();
  });

  it("shows observations from your areas only", async () => {
    localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify([kebnekaise.id]));
    mockLoad.mockResolvedValue(forecasts("published", 2));
    const base = { userId: 2, author: "Anna", lat: 0, lon: 0, observedAt: new Date().toISOString(), createdAt: "", imagePath: null, hidden: false, reportCount: 0 };
    mockObservations.mockResolvedValue([
      { ...base, id: 1, type: "lavin", regionId: kebnekaise.id, description: "Lavin i Kebne", dangerSigns: ["skjutsprickor"] },
      { ...base, id: 2, type: "lavin", regionId: "vastra-harjedalsfjallen", description: "Lavin i Härjedalen" },
    ]);
    renderPage();
    expect(await screen.findByText(/Lavin i Kebne/)).toBeInTheDocument();
    expect(screen.getByText("Skjutsprickor")).toBeInTheDocument();
    expect(screen.queryByText(/Lavin i Härjedalen/)).not.toBeInTheDocument();
  });

  it("welcomes a first-time visitor: areas picked in the guide land on the start page", async () => {
    localStorage.removeItem("fjallkoll:welcome-done");
    mockLoad.mockResolvedValue(forecasts("published", 2));
    renderPage();
    const dialog = await screen.findByRole("dialog", { name: "Välkommen till Snöläge" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Kom igång/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(kebnekaise.name) }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Nästa/ }));
    expect(within(dialog).getByRole("heading", { name: "Vill du få en notis?" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Klar/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("fjallkoll:welcome-done")).toBe("1");
    expect(await screen.findByRole("link", { name: kebnekaise.name })).toBeInTheDocument();
  });

  it("can skip the guide, and it stays away", async () => {
    localStorage.removeItem("fjallkoll:welcome-done");
    mockLoad.mockResolvedValue(forecasts("published", 2));
    const first = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Hoppa över" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();
    renderPage();
    await screen.findByText(/Tryck på/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
