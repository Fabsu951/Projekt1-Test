import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedRoute } from "../types/route";
import type { RouteAnalysis } from "../utils/routePlan";

const auth = { user: { id: 1 } as unknown, token: "t" as string | null };
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));
const createRoute = vi.fn();
const updateRoute = vi.fn();
vi.mock("../services/routeService", () => ({
  createRoute: (...a: unknown[]) => createRoute(...a),
  updateRoute: (...a: unknown[]) => updateRoute(...a),
  routeLink: (id: number) => `https://fjallkoll.test/karta?rutt=${id}`,
}));

import RouteSaveBox from "./RouteSaveBox";
import { useRouteDraft } from "../hooks/useRouteDraft";

const analysis = { ascentM: 600, descentM: 10, incomplete: false } as RouteAnalysis;
const saved = (over: Partial<PlannedRoute> = {}): PlannedRoute => ({
  id: 7,
  title: "Sydtoppen",
  waypoints: [[67.85, 18.6], [67.9, 18.52]],
  distanceM: 6000,
  ascentM: 600,
  descentM: 10,
  regionId: "kebnekaisefjallen",
  shared: false,
  mine: true,
  createdAt: "2026-10-05T10:00:00Z",
  updatedAt: "2026-10-05T10:00:00Z",
  ...over,
});

/** The box wired to the real draft hook, as on the map page. */
function Harness() {
  const route = useRouteDraft();
  return (
    <MemoryRouter>
      <RouteSaveBox
        draft={route.draft}
        dirty={route.dirty}
        analysis={analysis}
        onTitle={route.setTitle}
        onSaved={route.markSaved}
        onNew={route.startNew}
      />
      <button onClick={() => route.setPoints([...route.draft.points, [67.91, 18.5]])}>flytta</button>
    </MemoryRouter>
  );
}

describe("saving planned routes", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("fjallkoll:route-draft", JSON.stringify([[67.85, 18.6], [67.9, 18.52]]));
    createRoute.mockReset();
    updateRoute.mockReset();
    auth.user = { id: 1 };
    auth.token = "t";
  });

  it("saves a new route with its name and heights, then edits it in place", async () => {
    createRoute.mockResolvedValue(saved());
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Ruttens namn"), { target: { value: "Sydtoppen" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Spara i mitt konto" })));
    expect(createRoute).toHaveBeenCalledWith("t", {
      title: "Sydtoppen",
      waypoints: [[67.85, 18.6], [67.9, 18.52]],
      ascentM: 600,
      descentM: 10,
    });
    expect(screen.getByRole("button", { name: "Sparad ✓" })).toBeDisabled();
    expect(screen.getByText(/Rutten är privat/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "flytta" }));
    updateRoute.mockResolvedValue(saved({ waypoints: [[67.85, 18.6], [67.9, 18.52], [67.91, 18.5]] }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" })));
    expect(updateRoute).toHaveBeenCalledWith("t", 7, expect.objectContaining({ waypoints: expect.any(Array) }));
    expect(createRoute).toHaveBeenCalledTimes(1);
  });

  it("shares by link only when asked", async () => {
    createRoute.mockResolvedValue(saved());
    updateRoute.mockResolvedValue(saved({ shared: true }));
    render(<Harness />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Spara i mitt konto" })));
    await act(async () => fireEvent.click(screen.getByLabelText("Dela via länk")));
    expect(updateRoute).toHaveBeenCalledWith("t", 7, { shared: true });
    expect(screen.getByRole("button", { name: "Kopiera länk" })).toBeInTheDocument();
  });

  it("asks signed-out visitors to log in", () => {
    auth.user = null;
    auth.token = null;
    render(<Harness />);
    expect(screen.getByRole("link", { name: "Logga in" })).toHaveAttribute("href", "/logga-in?next=/karta");
  });

  it("opens someone else's shared route as an unsaved copy", () => {
    const { result } = renderHook(() => useRouteDraft());
    act(() => result.current.open(saved({ mine: false, shared: true })));
    expect(result.current.draft.id).toBeNull();
    expect(result.current.draft.title).toBe("Sydtoppen");
    expect(result.current.dirty).toBe(true);
  });
});
