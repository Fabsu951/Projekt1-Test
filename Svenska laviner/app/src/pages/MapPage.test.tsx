import { fireEvent, render, screen } from "@testing-library/react";
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
});
