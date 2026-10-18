import { describe, expect, it } from "vitest";
import L from "leaflet";
import "./leafletFixes";

describe("leafletFixes", () => {
  it("ignores a zoom animation that ends after the map was removed", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const map = L.map(div).setView([67.9, 18.5], 10);
    const internal = map as unknown as { _animatingZoom: boolean; _onZoomTransitionEnd: () => void };
    internal._animatingZoom = true; // as if the user had just zoomed
    map.remove();
    expect(() => internal._onZoomTransitionEnd()).not.toThrow();
  });
});
