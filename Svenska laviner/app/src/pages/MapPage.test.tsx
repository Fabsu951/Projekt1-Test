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
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Marker: () => null,
  Popup: () => null,
  Polyline: () => null,
  useMap: () => ({ invalidateSize: () => {}, fitBounds: () => {}, setView: () => {}, getZoom: () => 5, attributionControl: null }),
  useMapEvents: () => null,
  CircleMarker: () => null,
}));
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
    expect(JSON.parse(localStorage.getItem("fjallkoll:route-draft")!)).toHaveLength(1);
  });
});
