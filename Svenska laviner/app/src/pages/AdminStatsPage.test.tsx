import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: 1, isAdmin: true }, token: "tok", loading: false } as Record<string, unknown> }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../services/adminService", () => ({
  fetchAdminStats: async () => ({
    totals: {
      users: 42, verifiedUsers: 40, activeLastWeek: 12, observations: 7, hiddenObservations: 0, tours: 9, sharedTours: 6,
      routes: 3, comments: 5, follows: 8, tripPlans: 2, webPush: 4, appDevices: 1, openReports: 1,
    },
    weeks: Array.from({ length: 12 }, (_, i) => ({ week: `2026-${String(7 + Math.floor(i / 4)).padStart(2, "0")}-0${1 + (i % 4)}`, users: i, observations: 0, tours: 1 })),
    regions: [{ regionId: "kebnekaisefjallen", name: "Kebnekaisefjällen", favorites: 30, observations: 5, tours: 4 }],
  }),
}));

import AdminStatsPage from "./AdminStatsPage";

describe("AdminStatsPage", () => {
  it("shows totals, weekly bars with their numbers, and areas", async () => {
    render(<MemoryRouter><AdminStatsPage /></MemoryRouter>);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("40 med bekräftad e-post")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Nya konton per vecka:/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gå till anmälda inlägg" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Kebnekaisefjällen" })).toBeInTheDocument();
  });

  it("is for admins only", () => {
    auth.value = { user: { id: 2, isAdmin: false }, token: "tok", loading: false };
    const { container } = render(<MemoryRouter><AdminStatsPage /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
