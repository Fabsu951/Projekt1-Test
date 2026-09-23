import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-relief";

// Elevation data comes from leaflet-relief's default source, Mapterhorn
// (tiles.mapterhorn.com) — open, no API key. Despite the library's own
// README describing AWS's older Terrarium bucket as the default, the
// published package (checked in dist/leaflet-relief.esm.js) actually
// defaults to Mapterhorn; same Terrarium pixel encoding either way, just a
// different, more actively maintained host.
//
// Slope-angle color stops follow the convention used by CalTopo/Gaia
// GPS-style avalanche terrain maps: calm blue below ~28° (not
// avalanche-relevant), ramping through yellow/orange/red into the 30-45°
// band where most skier-triggered slab avalanches start, capping at a dark
// magenta beyond 45° (steep enough that snow tends to slide before it can
// build up).
const SLOPE_STOPS: Array<[number, [number, number, number]]> = [
  [0, [50, 90, 130]],
  [28, [50, 90, 130]],
  [30, [255, 235, 59]],
  [35, [255, 152, 0]],
  [40, [244, 67, 54]],
  [45, [140, 20, 90]],
  [55, [140, 20, 90]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function slopeColor(slopeDegrees: number): [number, number, number] {
  for (let i = 0; i < SLOPE_STOPS.length - 1; i++) {
    const [angleA, colorA] = SLOPE_STOPS[i];
    const [angleB, colorB] = SLOPE_STOPS[i + 1];
    if (slopeDegrees >= angleA && slopeDegrees <= angleB) {
      const t = angleB === angleA ? 0 : (slopeDegrees - angleA) / (angleB - angleA);
      return [
        lerp(colorA[0], colorB[0], t),
        lerp(colorA[1], colorB[1], t),
        lerp(colorA[2], colorB[2], t),
      ];
    }
  }
  return SLOPE_STOPS[SLOPE_STOPS.length - 1][1];
}

interface Props {
  enabled: boolean;
}

export default function SlopeLayer({ enabled }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const layer = L.gridLayer.relief({
      mode: "slope",
      opacity: 0.55,
      slopeColorFunction: slopeColor,
      minZoom: 11,
    });
    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [enabled, map]);

  return null;
}
