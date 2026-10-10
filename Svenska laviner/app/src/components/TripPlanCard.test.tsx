import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: 1 }, token: "tok" } as { user: unknown; token: string | null } }));
const service = vi.hoisted(() => ({
  fetchTripsAndInvitations: vi.fn(),
  planTrip: vi.fn(),
  removeTrip: vi.fn(),
  inviteToTrip: vi.fn(),
  answerInvitation: vi.fn(),
}));
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
    service.fetchTripsAndInvitations.mockResolvedValue({
      trips: [{ id: 7, regionId: "riksgransfjallen", date: "2026-02-14", notified: false }],
      invitations: [],
    });
    service.planTrip.mockResolvedValue({ id: 8, regionId: "kebnekaisefjallen", date: "2026-02-14", notified: false });
    show();
    const tomorrow = await screen.findByRole("button", { name: "I morgon" });
    await waitFor(() => expect(tomorrow).toBeEnabled());
    expect(tomorrow).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Idag" })).toBeInTheDocument();

    fireEvent.click(tomorrow);
    await waitFor(() => expect(tomorrow).toHaveAttribute("aria-pressed", "true"));
    expect(service.planTrip).toHaveBeenCalledWith("tok", "kebnekaisefjallen", "2026-02-14", undefined);
    expect(screen.getByRole("status")).toHaveTextContent("I morgon: väntar på prognosen");

    fireEvent.click(tomorrow);
    await waitFor(() => expect(tomorrow).toHaveAttribute("aria-pressed", "false"));
    expect(service.removeTrip).toHaveBeenCalledWith("tok", 8);
  });

  it("shows an invitation to someone's day here, and accepting reloads the plans", async () => {
    service.fetchTripsAndInvitations.mockResolvedValueOnce({
      trips: [],
      invitations: [
        { id: 3, from: { id: 2, displayName: "Bertil" }, regionId: "kebnekaisefjallen", date: "2026-02-14", routeTitle: "Sydtoppen" },
        { id: 4, from: { id: 2, displayName: "Bertil" }, regionId: "riksgransfjallen", date: "2026-02-15", routeTitle: null },
      ],
    });
    service.fetchTripsAndInvitations.mockResolvedValueOnce({
      trips: [{ id: 9, regionId: "kebnekaisefjallen", date: "2026-02-14", notified: false, company: [{ id: 2, displayName: "Bertil" }] }],
      invitations: [],
    });
    service.answerInvitation.mockResolvedValue({ accepted: true, tripId: 9 });
    show();
    expect(await screen.findByText("Bertil bjuder in dig till en tur i morgon. Rutt: Sydtoppen.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Gå med" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Gå med" }));
    expect(await screen.findByText("Med på turen: Bertil")).toBeInTheDocument();
    expect(service.answerInvitation).toHaveBeenCalledWith("tok", 3, true);
  });
});
