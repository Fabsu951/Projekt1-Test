import { act, render } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyPosition from "./MyPosition";

type Callback = (pos: { coords: { latitude: number; longitude: number; accuracy: number } } | null, err?: unknown) => void;

const { geo } = vi.hoisted(() => ({
  geo: {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(async () => {}),
  },
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: geo }));

// jsdom can't render Leaflet's SVG paths, so stand in for the two shapes.
vi.mock("react-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-leaflet")>();
  const Shape = ({ pathOptions }: { pathOptions?: { className?: string } }) => <div className={pathOptions?.className} />;
  return { ...actual, Circle: Shape, CircleMarker: Shape };
});

let callback: Callback;
beforeEach(() => {
  geo.watchPosition.mockReset().mockImplementation(async (_opts: unknown, cb: Callback) => {
    callback = cb;
    return "watch-1";
  });
  geo.clearWatch.mockClear();
});

function renderMap(enabled: boolean, onStatus = vi.fn()) {
  const ui = (on: boolean) => (
    <MapContainer center={[65.6, 15.2]} zoom={5} style={{ height: 300, width: 300 }}>
      <MyPosition enabled={on} onStatus={onStatus} />
    </MapContainer>
  );
  const view = render(ui(enabled));
  return { ...view, onStatus, setEnabled: (on: boolean) => view.rerender(ui(on)) };
}

describe("MyPosition", () => {
  it("does nothing until turned on", () => {
    renderMap(false);
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it("follows the position and draws a dot with an accuracy circle", async () => {
    const { container, onStatus } = renderMap(true);
    await act(async () => {});
    expect(geo.watchPosition).toHaveBeenCalledWith(expect.objectContaining({ enableHighAccuracy: true }), expect.any(Function));
    expect(onStatus).toHaveBeenLastCalledWith("Hämtar din position…");

    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.6, accuracy: 25 } }));
    expect(onStatus).toHaveBeenLastCalledWith(null);
    expect(container.querySelector(".my-position__dot")).not.toBeNull();
    expect(container.querySelector(".my-position__accuracy")).not.toBeNull();
  });

  it("explains when the position can't be read", async () => {
    const { onStatus } = renderMap(true);
    await act(async () => {});
    await act(async () => callback(null, new Error("denied")));
    expect(onStatus).toHaveBeenLastCalledWith(expect.stringMatching(/Kunde inte hämta din position/));
  });

  it("stops watching and removes the dot when turned off", async () => {
    const { container, setEnabled } = renderMap(true);
    await act(async () => {});
    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.6, accuracy: 25 } }));
    setEnabled(false);
    await act(async () => {});
    expect(geo.clearWatch).toHaveBeenCalledWith({ id: "watch-1" });
    expect(container.querySelector(".my-position__dot")).toBeNull();
  });
});
