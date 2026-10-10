import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createObservation: vi.fn(),
  getCurrentPosition: vi.fn(),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: 1, canPost: true }, token: "tok", loading: false }) }));
vi.mock("../services/observationService", () => ({ createObservation: mocks.createObservation }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { getCurrentPosition: mocks.getCurrentPosition } }));
vi.mock("../components/LocationPicker", () => ({ default: () => <div>Karta för att välja plats</div> }));

import QuickObservationPage from "./QuickObservationPage";

const show = () =>
  render(
    <MemoryRouter initialEntries={["/observationer/snabb"]}>
      <Routes>
        <Route path="/observationer/snabb" element={<QuickObservationPage />} />
        <Route path="/observationer" element={<p>Observationslistan</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("QuickObservationPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends what you tapped, at your position, now", async () => {
    mocks.getCurrentPosition.mockResolvedValue({ coords: { latitude: 67.9, longitude: 18.5, accuracy: 8 } });
    mocks.createObservation.mockResolvedValue({});
    show();
    const send = screen.getByRole("button", { name: "Välj vad du ser" });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Skjutsprickor" }));
    expect(await screen.findByText("Position från telefonen (±8 m).")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skicka observationen" }));
    expect(await screen.findByText("Observationslistan")).toBeInTheDocument();
    expect(mocks.createObservation).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({
        type: "sprickor",
        lat: 67.9,
        lon: 18.5,
        regionId: "kebnekaisefjallen",
        dangerSigns: ["skjutsprickor"],
        description: "Snabbobservation: Skjutsprickor.",
        image: null,
      })
    );
  });

  it("shows the map when the phone can't tell where you are", async () => {
    mocks.getCurrentPosition.mockRejectedValue(new Error("denied"));
    show();
    expect(await screen.findByText("Karta för att välja plats")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inga varningstecken" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Väntar på position…" })).toBeDisabled());
  });
});
