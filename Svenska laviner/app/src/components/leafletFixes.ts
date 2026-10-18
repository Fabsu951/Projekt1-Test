import L from "leaflet";

// Leaflet finishes a zoom animation 250 ms later from a timer. If the map is
// removed in between (zoom, then switch page right away), that timer runs on
// a dead map and throws "reading '_leaflet_pos'". Skip it once the map is gone.
type ZoomEnd = { _mapPane?: HTMLElement; _onZoomTransitionEnd: () => void };
const proto = L.Map.prototype as unknown as ZoomEnd;
const finishZoom = proto._onZoomTransitionEnd;
proto._onZoomTransitionEnd = function (this: ZoomEnd) {
  if (!this._mapPane) return;
  finishZoom.call(this);
};
