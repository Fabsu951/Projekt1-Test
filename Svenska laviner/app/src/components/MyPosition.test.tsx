import { act, render } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyPosition from "./MyPosition";

type Coords = { latitude: number; longitude: number; accuracy: number; heading?: number | null; speed?: number | null };
type Callback = (pos: { coords: Coords } | null, err?: unknown) => void;

const { geo } = vi.hoisted(() => ({
  geo: {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(async () => {}),
  },
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: geo }));

// jsdom can't render Leaflet's SVG paths, so stand in for the accuracy circle.
vi.mock("react-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-leaflet")>();
  const Shape = ({ pathOptions }: { pathOptions?: { className?: string } }) => <div className={pathOptions?.className} />;
  return { ...actual, Circle: Shape };
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
    <MemoryRouter>
      <MapContainer center={[65.6, 15.2]} zoom={5} style={{ height: 300, width: 300 }}>
        <MyPosition enabled={on} onStatus={onStatus} />
      </MapContainer>
    </MemoryRouter>
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
    expect(container.querySelector(".my-pos__dot")).not.toBeNull();
    expect(container.querySelector(".my-position__accuracy")).not.toBeNull();
    // Standing still and no compass: no direction to show.
    expect(container.querySelector<SVGElement>(".my-pos__cone")?.style.display).toBe("none");
  });

  it("points the cone along the GPS course while moving", async () => {
    const { container } = renderMap(true);
    await act(async () => {});
    await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.6, accuracy: 10, heading: 90, speed: 2 } }));
    const cone = container.querySelector<SVGElement>(".my-pos__cone");
    expect(cone?.style.display).toBe("block");
    expect(cone?.style.transform).toBe("rotate(90.0deg)");
  });

  it("turns the cone with the compass", async () => {
    class FakeOrientationEvent extends Event {}
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientationEvent);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    try {
      const { container } = renderMap(true);
      await act(async () => {});
      await act(async () => callback({ coords: { latitude: 67.9, longitude: 18.6, accuracy: 10 } }));
      await act(async () => {
        const event = new Event("deviceorientationabsolute");
        Object.assign(event, { alpha: 90 });
        window.dispatchEvent(event);
      });
      const cone = container.querySelector<SVGElement>(".my-pos__cone");
      expect(cone?.style.display).toBe("block");
      expect(cone?.style.transform).toBe("rotate(270.0deg)");
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(container.querySelector(".my-pos__dot")).toBeNull();
  });
});
