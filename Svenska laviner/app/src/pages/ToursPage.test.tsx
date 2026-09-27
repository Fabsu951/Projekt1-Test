import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToursPage from "./ToursPage";
import type { Tour } from "../types/tour";

const { fetchTours } = vi.hoisted(() => ({ fetchTours: vi.fn() }));
vi.mock("../services/tourService", () => ({ fetchTours }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null }) }));

const TOUR: Tour = {
  id: 1,
  userId: 2,
  author: "Fjällräv",
  title: "Kebnekaise sydtopp",
  description: "",
  startedAt: "2027-03-10T08:00:00.000Z",
  durationS: 25_200,
  distanceM: 18_400,
  ascentM: 1420,
  descentM: 1410,
  maxElevationM: 2096,
  regionId: "kebnekaisefjallen",
  shared: true,
  hideEndsM: 500,
  pin: [67.86, 18.59],
  createdAt: "2027-03-11T08:00:00.000Z",
};

beforeEach(() => fetchTours.mockReset().mockResolvedValue([TOUR]));

describe("ToursPage", () => {
  it("lists shared tours with their key numbers", async () => {
    render(
      <MemoryRouter>
        <ToursPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole("link", { name: "Kebnekaise sydtopp" })).toHaveAttribute("href", "/turer/1");
    expect(screen.getByText("18,4 km")).toBeInTheDocument();
    expect(screen.getByText("↑ 1420 m")).toBeInTheDocument();
    expect(screen.getByText("7 h 0 min")).toBeInTheDocument();
  });

  it("filters by the parts of the season you pick", async () => {
    render(
      <MemoryRouter>
        <ToursPage />
      </MemoryRouter>
    );
    await screen.findByText("Kebnekaise sydtopp");
    fireEvent.click(screen.getByLabelText("Vårvinter (mar–apr)"));
    await waitFor(() => expect(fetchTours).toHaveBeenLastCalledWith({ region: undefined, months: [3, 4] }));
    fireEvent.click(screen.getByLabelText("Tidig vinter (nov–dec)"));
    await waitFor(() => expect(fetchTours).toHaveBeenLastCalledWith({ region: undefined, months: [11, 12, 3, 4] }));
  });
});
