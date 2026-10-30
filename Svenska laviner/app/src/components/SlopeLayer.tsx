import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-relief";
import { FLAT, slopeColor } from "../utils/slopeColors";
import { t } from "../i18n";

// Elevation data comes from leaflet-relief's default source, Mapterhorn
// (tiles.mapterhorn.com) — open, no API key, Terrarium encoding. In Sweden
// and Norway Mapterhorn is built from the national 1 m height models
// (Lantmäteriet's Markhöjdmodell Nedladdning, CC0; Kartverket's DTM, CC BY 4.0),
// checked against its attribution list and real tiles on 2026-10-30.
// Colours: utils/slopeColors.ts (the route planner's steps, flat ground clear).

/**
 * Computed at most at this zoom and enlarged beyond: at ~2 m per pixel the
 * 1 m data still shows real slopes, while finer pixels mostly add single
 * boulders and snow-free crevasse edges as noise.
 */
const MAX_NATIVE_ZOOM = 14;

const SLOPE_ATTRIBUTION = t(
  'Lutning: höjdmodeller &copy; Lantmäteriet och &copy; Kartverket (<a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a>) via <a href="https://mapterhorn.com/attribution/">Mapterhorn</a>'
);

const TRANSPARENT = [0, 0, 0, 0];

type ReliefPixels = { _createSlopeColor(e: unknown, t: unknown): number[] };

interface Props {
  enabled: boolean;
}

export default function SlopeLayer({ enabled }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const layer = L.gridLayer.relief({
      mode: "slope",
      opacity: 0.7,
      slopeColorFunction: slopeColor,
      minZoom: 11,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      zIndex: 4, // above the Norwegian map layer (TopoLayer)
      attribution: SLOPE_ATTRIBUTION,
    });
    // leaflet-relief always draws an opaque pixel; make flat ground transparent.
    const pixels = layer as unknown as ReliefPixels;
    const draw = pixels._createSlopeColor;
    pixels._createSlopeColor = function (e, t) {
      const c = draw.call(this, e, t);
      return c[0] === FLAT[0] && c[1] === FLAT[1] && c[2] === FLAT[2] ? TRANSPARENT : c;
    };
    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [enabled, map]);

  return null;
}
