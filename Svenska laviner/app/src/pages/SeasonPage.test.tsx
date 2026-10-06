import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonPage from "./SeasonPage";
import { toSeason } from "../services/avalancheService";

const { fetchSeason } = vi.hoisted(() => ({ fetchSeason: vi.fn() }));
vi.mock("../services/avalancheService", async (orig) => ({
  ...(await orig<typeof import("../services/avalancheService")>()),
  fetchSeason,
  currentSeason: () => 2025,
}));

const season = toSeason({
  regionId: "sodra-jamtlandsfjallen",
  season: 2025,
  days: [
    { date: "2026-02-17", danger: 1, problems: ["drevsnoflak"] },
    { date: "2026-02-18", danger: 2, problems: ["drevsnoflak", "bestaende-flak"] },
    { date: "2026-02-19", danger: 3, problems: ["bestaende-flak"] },
    { date: "2026-02-20", danger: 0, label: "Ej bedömd lavinfara", problems: [] },
  ],
  problems: [
    { type: "bestaende-flak", name: "Bestående flak", days: 2 },
    { type: "drevsnoflak", name: "Drevsnöflak", days: 2 },
  ],
})!;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/omrade/sodra-jamtlandsfjallen/sasong"]}>
      <Routes>
        <Route path="/omrade/:id/sasong" element={<SeasonPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SeasonPage", () => {
  beforeEach(() => fetchSeason.mockReset().mockResolvedValue(season));

  it("shows every day with its level, and days without one as what they were", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /18 feb.*: 2 Måttlig fara/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /20 feb.*: Ej bedömd lavinfara/ })).toHaveTextContent("·");
    expect(screen.getByText("dagar med farograd").previousSibling).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: /18 feb/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Drevsnöflak, Bestående flak");
  });

  it("leaves out months without daily forecasts and says when they ran", async () => {
    fetchSeason.mockResolvedValue(
      toSeason({
        regionId: "kebnekaisefjallen",
        season: 2025,
        days: [
          { date: "2025-11-30", danger: 0, label: "Ej bedömd lavinfara", problems: [] },
          { date: "2026-02-20", danger: 2, problems: [] },
          { date: "2026-04-11", danger: 3, problems: [] },
        ],
        problems: [],
      })!
    );
    renderPage();
    expect(await screen.findByText(/Dagliga prognoser 20 feb 2026 – 11 apr 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "nov 2025" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "dec 2025" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "jan 2026" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "mar 2026" })).toBeNull();
    expect(screen.getByRole("heading", { name: "feb 2026" })).toBeInTheDocument();
  });

  it("loads another season when chosen", async () => {
    renderPage();
    await screen.findByRole("button", { name: /18 feb/ });
    fireEvent.click(screen.getByRole("button", { name: "2023/24" }));
    await waitFor(() => expect(fetchSeason).toHaveBeenLastCalledWith("sodra-jamtlandsfjallen", 2023));
  });

  it("never turns 0, 6 or 7 into a level", () => {
    const s = toSeason({ regionId: "x", season: 2025, days: [{ date: "2026-04-01", danger: 6, label: "Vårförhållanden", problems: [] }] })!;
    expect(s.days[0]).toMatchObject({ dangerLevel: null, label: "Vårförhållanden" });
    expect(Object.values(s.levels).every((n) => n === 0)).toBe(true);
  });
});
