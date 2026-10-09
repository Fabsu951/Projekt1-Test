import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/avalancheService", async (orig) => ({
  ...(await orig<typeof import("../services/avalancheService")>()),
  loadForecasts: () => new Promise(() => {}),
}));
vi.mock("../services/observationService", () => ({ fetchObservations: () => Promise.resolve([]) }));
vi.mock("../services/tourService", () => ({
  fetchTours: () => Promise.resolve([]),
  fetchTourLines: () => Promise.resolve([]),
}));
const { fakeMap } = vi.hoisted(() => ({
  // One stable object, like Leaflet's real map instance.
  fakeMap: {
    invalidateSize: () => {},
    fitBounds: () => {},
    setView: () => {},
    getZoom: () => 5,
    attributionControl: null,
    on: () => {},
    off: () => {},
    getBounds: () => ({ getNorth: () => 68, getSouth: () => 67.8, getWest: () => 18.3, getEast: () => 18.7 }),
  },
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Marker: () => null,
  Popup: () => null,
  Polyline: () => null,
  useMap: () => fakeMap,
  useMapEvents: () => null,
  CircleMarker: () => null,
}));
vi.mock("../services/routeService", () => ({
  fetchRoute: () =>
    Promise.resolve({ id: 7, title: "Sydtoppen", waypoints: [[67.85, 18.6], [67.9, 18.52]], mine: false, shared: true }),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null, token: null, loading: false }) }));
vi.mock("../components/TopoLayer", () => ({ default: () => null }));
vi.mock("../components/SlopeLayer", () => ({ default: () => null }));
vi.mock("../components/MyPosition", () => ({ default: () => null }));

import MapPage from "./MapPage";

describe("MapPage layer menu", () => {
  beforeEach(() => localStorage.clear());

  it("folds the layer menu in and out and remembers the choice", () => {
    const { unmount } = render(<MemoryRouter><MapPage /></MemoryRouter>);
    const toggle = screen.getByRole("button", { name: /Kartlager/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("(1 på)"); // observations are on by default
    expect(screen.getByLabelText("Turer")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("map-layers")).not.toBeVisible();
    unmount();

    render(<MemoryRouter><MapPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Kartlager/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("starts with the layer menu closed on a phone", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query })) as never;
    try {
      render(<MemoryRouter><MapPage /></MemoryRouter>);
      expect(screen.getByRole("button", { name: /Kartlager/ })).toHaveAttribute("aria-expanded", "false");
    } finally {
      window.matchMedia = original;
    }
  });

  it("opens the map in full screen and leaves it with Escape", () => {
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    expect(document.querySelector(".page--map-full")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Karta" })).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".page--map-full")).toBeNull();
    expect(screen.getByRole("heading", { name: "Karta" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("plans a route: hint first, then distance from a saved draft, and undo", async () => {
    localStorage.setItem("fjallkoll:route-draft", JSON.stringify([[67.85, 18.6], [67.86, 18.6]]));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Planera rutt" }));
    const panel = await screen.findByRole("region", { name: "Ruttplanering" });
    // Elevation tiles can't load in the test browser: distance still shows, heights are flagged as missing.
    await waitFor(() => expect(panel).toHaveTextContent("Distans"), { timeout: 3000 });
    expect(panel).toHaveTextContent("1,1 km");
    expect(panel).toHaveTextContent("Höjddata saknas");

    fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
    expect(panel).toHaveTextContent("Klicka vidare");
    expect(JSON.parse(localStorage.getItem("fjallkoll:route-draft")!).points).toHaveLength(1);
  });

  it("opens a shared route from a link in the planner", async () => {
    render(<MemoryRouter initialEntries={["/karta?rutt=7"]}><MapPage /></MemoryRouter>);
    const panel = await screen.findByRole("region", { name: "Ruttplanering" });
    expect(panel).toBeInTheDocument();
    const draft = JSON.parse(localStorage.getItem("fjallkoll:route-draft")!);
    expect(draft.points).toHaveLength(2);
    expect(draft.title).toBe("Sydtoppen");
    expect(draft.id).toBeNull(); // someone else's route: an unsaved copy
  });
});
