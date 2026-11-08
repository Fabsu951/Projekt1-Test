import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Position = { coords: { latitude: number; longitude: number; altitude: number | null; accuracy: number }; timestamp: number };
const mocks = vi.hoisted(() => ({
  watcher: null as null | ((p: Position | null) => void),
  createTour: vi.fn(),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: 1, canPost: true }, token: "tok", loading: false }) }));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    watchPosition: vi.fn(async (_o: unknown, cb: (p: Position | null) => void) => {
      mocks.watcher = cb;
      return "w1";
    }),
    clearWatch: vi.fn(async () => {}),
  },
}));
vi.mock("../components/RecordingMap", () => ({ default: () => <div>Karta med spåret</div> }));
vi.mock("../components/TrackMap", () => ({ default: () => <div>Karta med turen</div> }));
vi.mock("../utils/groundElevation", () => ({ withGroundElevation: async (p: unknown) => p }));
vi.mock("../services/tourService", async (orig) => ({ ...(await orig<object>()), createTour: mocks.createTour }));

import RecordTourPage from "./RecordTourPage";
import NewTourPage from "./NewTourPage";
import { RECORDING_CHANGED_EVENT } from "../services/tourRecorder";

function TourShown() {
  return <p>Tur {useParams().id} sparad</p>;
}

const show = () =>
  render(
    <MemoryRouter initialEntries={["/turer/spela-in"]}>
      <Routes>
        <Route path="/turer/spela-in" element={<RecordTourPage />} />
        <Route path="/turer/ny" element={<NewTourPage />} />
        <Route path="/turer/:id" element={<TourShown />} />
      </Routes>
    </MemoryRouter>,
  );

const move = (i: number, t0: number) =>
  act(() => {
    mocks.watcher?.({ coords: { latitude: 67.9 + i * 0.0001, longitude: 18.5, altitude: 800 + i, accuracy: 5 }, timestamp: t0 + i * 3000 });
    window.dispatchEvent(new Event(RECORDING_CHANGED_EVENT));
  });

describe("RecordTourPage (in a browser)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, "geolocation", { value: {}, configurable: true });
  });
  afterEach(() => localStorage.clear());

  it("records, finishes and saves the track as a tour, then forgets the recording", async () => {
    mocks.createTour.mockResolvedValue({ id: 42 });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Starta inspelningen" }));
    expect(await screen.findByText("Spelar in")).toBeInTheDocument();
    expect(screen.getByText("Väntar på GPS – gå gärna ut i det fria.")).toBeInTheDocument();

    const t0 = Date.now() - 600_000;
    move(0, t0);
    move(10, t0);
    move(20, t0);
    expect(await screen.findByText("222 m")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    expect(await screen.findByText("Pausad")).toBeInTheDocument();
    move(30, t0); // not recorded while paused
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText("Spelar in")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Avsluta" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, avsluta" }));
    expect(await screen.findByRole("heading", { name: "Spara turen" })).toBeInTheDocument();
    expect(await screen.findByText(/Inspelad med Snöläge/)).toBeInTheDocument();
    expect((screen.getByLabelText("Titel") as HTMLInputElement).value).toMatch(/^Tur /);

    fireEvent.click(screen.getByRole("button", { name: "Spara tur" }));
    expect(await screen.findByText("Tur 42 sparad")).toBeInTheDocument();
    const sent = mocks.createTour.mock.calls[0][1];
    expect(sent.points).toHaveLength(3);
    expect(sent.points[0]).toEqual([67.9, 18.5, 800, t0]);
    await waitFor(() => expect(localStorage.getItem("fjallkoll:tour-recording")).toBeNull());
  });

  it("keeps the recording when there is no coverage to save it", async () => {
    const { ApiError } = await import("../services/api");
    mocks.createTour.mockRejectedValue(new ApiError(0, "offline"));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Starta inspelningen" }));
    await screen.findByText("Spelar in");
    const t0 = Date.now() - 600_000;
    move(0, t0);
    move(10, t0);
    fireEvent.click(screen.getByRole("button", { name: "Avsluta" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, avsluta" }));
    await screen.findByText(/Inspelad med Snöläge/);
    fireEvent.click(screen.getByRole("button", { name: "Spara tur" }));
    expect(await screen.findByText("Ingen täckning just nu. Turen ligger kvar i telefonen – spara den när du har täckning.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("fjallkoll:tour-recording")!).state).toBe("finished");
  });

  it("tells you when the browser can't find your position", async () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Starta inspelningen" }));
    expect(await screen.findByText("Den här webbläsaren kan inte ta fram din position.")).toBeInTheDocument();
  });
});
