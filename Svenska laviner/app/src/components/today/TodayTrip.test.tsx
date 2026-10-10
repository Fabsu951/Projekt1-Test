import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TodayTrip from "./TodayTrip";
import type { AvalancheForecast } from "../../types/avalanche";

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ user: { id: 1 }, token: "tok" }) }));
vi.mock("../../services/offlineMap", () => ({ savedArea: () => Promise.resolve(null) }));
vi.mock("../../services/avalancheService", () => ({
  fetchForecastHistory: () => Promise.resolve([{ date: "2027-02-06", dangerLevel: null }]),
}));
vi.mock("../../services/tripService", () => ({
  fetchTrips: () =>
    Promise.resolve([
      { id: 1, regionId: "kebnekaisefjallen", date: "2027-02-05", notified: true, routeId: 4, routeTitle: "Sydtoppen", invites: [{ id: 1, user: { id: 2, displayName: "Bertil" }, status: "accepted" }] },
      { id: 2, regionId: "riksgransfjallen", date: "2027-02-06", notified: false },
      { id: 3, regionId: "sodra-jamtlandsfjallen", date: "2027-02-09", notified: false },
    ]),
}));

const forecast: AvalancheForecast = {
  regionId: "kebnekaisefjallen",
  status: "published",
  dangerLevel: 3,
  problems: [],
  headline: "Betydande lavinfara på kalfjället",
  mainMessage: null,
  publishedText: null,
  sourceUrl: "https://www.lavinprognoser.se/",
};

describe("TodayTrip", () => {
  it("leads with today's and tomorrow's planned days, never guessing tomorrow's level", async () => {
    render(
      <MemoryRouter>
        <TodayTrip forecasts={{ kebnekaisefjallen: forecast }} now={new Date("2027-02-05T07:00:00Z")} />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Din tur idag" })).toBeInTheDocument();
    expect(screen.getByText("Betydande lavinfara på kalfjället")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sydtoppen" })).toHaveAttribute("href", "/karta?rutt=4");
    expect(screen.getByText(/Med dig: Bertil/)).toBeInTheDocument();
    expect(await screen.findAllByText("Kartan är inte sparad offline än.")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Riksgränsfjällen" })).toBeInTheDocument();
    expect(screen.getByText(/publiceras runt kl 18/)).toBeInTheDocument();
    expect(screen.queryByText(/Södra Jämtland/)).not.toBeInTheDocument();
  });
});
