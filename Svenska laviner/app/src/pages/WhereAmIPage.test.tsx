import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WhereAmIPage from "./WhereAmIPage";

type Callback = (
  pos: { coords: { latitude: number; longitude: number; accuracy: number; altitude?: number | null }; timestamp: number } | null,
  err?: unknown,
) => void;

const { geo } = vi.hoisted(() => ({
  geo: { watchPosition: vi.fn(), clearWatch: vi.fn(async () => {}) },
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: geo }));

let callback: Callback;
beforeEach(() => {
  geo.watchPosition.mockReset().mockImplementation(async (_opts: unknown, cb: Callback) => {
    callback = cb;
    return "watch-1";
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <WhereAmIPage />
    </MemoryRouter>,
  );
}

describe("WhereAmIPage", () => {
  it("always offers to call 112, even before there is a fix", async () => {
    renderPage();
    await act(async () => {});
    expect(screen.getByRole("link", { name: /Ring 112/ })).toHaveAttribute("href", "tel:112");
    expect(screen.getByText(/Hämtar din position/)).toBeInTheDocument();
  });

  it("shows the position in WGS 84 and SWEREF 99 TM", async () => {
    renderPage();
    await act(async () => {});
    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.55, accuracy: 8, altitude: 1240 }, timestamp: Date.now() }));
    expect(screen.getByText("67.90000° N, 18.55000° E")).toBeInTheDocument();
    expect(screen.getByText("N 67° 54,000′  E 18° 33,000′", { normalizer: (s) => s })).toBeInTheDocument();
    expect(screen.getByText("N 7 535 993  E 648 979", { normalizer: (s) => s })).toBeInTheDocument();
    expect(screen.getByText(/Noggrannhet ±8 m/)).toBeInTheDocument();
    expect(screen.queryByText(/Positionen är osäker/)).toBeNull();
  });

  it("warns when the fix is vague", async () => {
    renderPage();
    await act(async () => {});
    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.55, accuracy: 450 }, timestamp: Date.now() }));
    expect(screen.getByText(/Positionen är osäker/)).toBeInTheDocument();
  });

  it("copies every coordinate form", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await act(async () => {});
    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.55, accuracy: 8 }, timestamp: Date.now() }));
    await act(async () => screen.getByRole("button", { name: /Kopiera koordinaterna/ }).click());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("SWEREF 99 TM: N 7535993 E 648979"));
    expect(screen.getByRole("button", { name: /Kopierat/ })).toBeInTheDocument();
  });

  it("explains when the position can't be read", async () => {
    renderPage();
    await act(async () => {});
    await act(async () => callback(null, new Error("denied")));
    expect(screen.getByRole("alert")).toHaveTextContent(/Kunde inte hämta din position/);
  });
});
