import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: 1 }, token: "tok" } as { user: unknown; token: string | null } }));
const service = vi.hoisted(() => ({ fetchTrips: vi.fn(), planTrip: vi.fn(), removeTrip: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../services/tripService", () => service);

import TripPlanCard from "./TripPlanCard";

// Friday 13 Feb 2026 in Sweden.
const now = new Date(Date.UTC(2026, 1, 13, 12));
const show = () => render(<MemoryRouter><TripPlanCard regionId="kebnekaisefjallen" regionName="Kebnekaisefjällen" now={now} /></MemoryRouter>);

describe("TripPlanCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = { user: { id: 1 }, token: "tok" };
  });

  it("asks you to log in first", () => {
    auth.value = { user: null, token: null };
    show();
    expect(screen.getByRole("link", { name: "Logga in" })).toHaveAttribute("href", "/logga-in?next=/omrade/kebnekaisefjallen");
  });

  it("plans and unplans a day, and shows what is planned here", async () => {
    service.fetchTrips.mockResolvedValue([
      { id: 7, regionId: "riksgransfjallen", date: "2026-02-14", notified: false },
    ]);
    service.planTrip.mockResolvedValue({ id: 8, regionId: "kebnekaisefjallen", date: "2026-02-14", notified: false });
    show();
    const tomorrow = await screen.findByRole("button", { name: "I morgon" });
    await waitFor(() => expect(tomorrow).toBeEnabled());
    expect(tomorrow).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Idag" })).toBeInTheDocument();

    fireEvent.click(tomorrow);
    await waitFor(() => expect(tomorrow).toHaveAttribute("aria-pressed", "true"));
    expect(service.planTrip).toHaveBeenCalledWith("tok", "kebnekaisefjallen", "2026-02-14");
    expect(screen.getByRole("status")).toHaveTextContent("I morgon: väntar på prognosen");

    fireEvent.click(tomorrow);
    await waitFor(() => expect(tomorrow).toHaveAttribute("aria-pressed", "false"));
    expect(service.removeTrip).toHaveBeenCalledWith("tok", 8);
  });
});
