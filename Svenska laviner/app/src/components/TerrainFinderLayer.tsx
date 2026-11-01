import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-relief";
import { matchesTerrain, slopeAspect, type TerrainFilter } from "../utils/terrainFinder";
import { t } from "../i18n";

// "Hitta åk": colours the ground whose steepness and aspect match the user's
// filter. Built on leaflet-relief in slope mode (it fetches Mapterhorn's
// height tiles and hands every pixel's 3×3 height window to
// _createSlopeColor), with that function replaced by our own test.

/** The colour of matching ground; the aspect rose in the controls uses the same (`--finder`). */
const FINDER_RGB: [number, number, number] = [90, 63, 214];
const MATCH = [...FINDER_RGB, 255];
const CLEAR = [0, 0, 0, 0];

/**
 * Computed at most at this zoom (~7 m pixels in the mountains) and enlarged
 * beyond: smooth enough to show runs rather than single boulders, and
 * slopes are measured over about ±7 m.
 */
const MAX_NATIVE_ZOOM = 13;
const MIN_ZOOM = 10;

const ATTRIBUTION = t(
  'Lutning: höjdmodeller &copy; Lantmäteriet och &copy; Kartverket (<a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a>) via <a href="https://mapterhorn.com/attribution/">Mapterhorn</a>'
);

type ReliefPixels = { _createSlopeColor(win: number[], pixelM: number): number[] };

interface Props {
  filter: TerrainFilter | null;
}

export default function TerrainFinderLayer({ filter }: Props) {
  const map = useMap();
  const enabled = filter !== null;
  const filterRef = useRef(filter);
  const layerRef = useRef<L.GridLayer | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const layer = L.gridLayer.relief({
      mode: "slope",
      opacity: 0.6,
      minZoom: MIN_ZOOM,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      zIndex: 4,
      attribution: ATTRIBUTION,
    });
    (layer as unknown as ReliefPixels)._createSlopeColor = (win, pixelM) => {
      const current = filterRef.current;
      if (!current) return CLEAR;
      const { slope, aspect } = slopeAspect(win, pixelM);
      return matchesTerrain(current, slope, aspect) ? MATCH : CLEAR;
    };
    filterRef.current = filter;
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layerRef.current = null;
      map.removeLayer(layer);
    };
    // The filter is read through the ref; changes redraw below instead of rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, map]);

  useEffect(() => {
    if (filterRef.current === filter) return;
    filterRef.current = filter;
    // New ranges: draw the tiles again (the height tiles come from the browser's
    // cache). Leaflet's redraw ignores minZoom, so below it there is nothing to redraw.
    if (layerRef.current && map.getZoom() >= MIN_ZOOM) layerRef.current.redraw();
  }, [filter, map]);

  return null;
}
