import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import { useEffect } from "react";
import { useMap, type TileLayerProps } from "react-leaflet";
import { OfflineTileLayer, type OfflineTileLayerOptions } from "./offlineTileLayer";
import {
  hostedTile,
  NORWAY_MAX_NATIVE_ZOOM,
  NORWAY_MIN_ZOOM,
  NORWAY_TOPO_ATTRIBUTION,
  NORWAY_TOPO_URL,
  TOPOWEBB_ATTRIBUTION,
  TOPOWEBB_FULL_ZOOM,
  TOPOWEBB_MAX_NATIVE_ZOOM,
  TOPOWEBB_URL,
} from "../services/mapTiles";
import { tileInNorwayOnly } from "../utils/norwayTiles";

/** Tiles saved for offline use (services/offlineMap.ts) are shown first when present. */
const OfflineAwareTileLayer = createTileLayerComponent<OfflineTileLayer, TileLayerProps & OfflineTileLayerOptions>(
  function createTileLayer({ url, ...options }, context) {
    return createElementObject(new OfflineTileLayer(url, withPane(options, context)), context);
  },
  function updateTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.url !== prevProps.url) layer.setUrl(props.url);
  }
);

// Keep more tiles around the view so panning back doesn't flash empty, and
// load new ones while the finger still pans. While zooming, only the level
// the map ends on is fetched: loading every level passed on the way (a
// mouse wheel step jumps two) queued hundreds of tiles that were thrown
// away, and outside our map bucket each one still cost a worker request –
// the map near the border took many seconds to sharpen (2026-11-01).
const SMOOTH = { keepBuffer: 4, updateWhenIdle: false, updateWhenZooming: false, updateInterval: 150 } as const;

// Kartverket's zoom-16 tiles carry a flat, featureless cream strip up to
// ~1.5 km into Sweden, which covered Lantmäteriet's map along the border
// (Fabian's videos, 2026-11-04). From BLEND_FROM_ZOOM Lantmäteriet's tiles are
// pure white over Norway (checked live), so there Lantmäteriet is drawn on top
// with "multiply": white × Kartverket = Kartverket in Norway, Lantmäteriet in
// Sweden (barely tinted in that strip). Below it Lantmäteriet still draws
// Norway as a faded backdrop, so the normal order stays.
const BLEND_FROM_ZOOM = 12;

function BorderBlend() {
  const map = useMap();
  useEffect(() => {
    const update = () => map.getContainer().classList.toggle("map--blend-topo", map.getZoom() >= BLEND_FROM_ZOOM);
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
      map.getContainer().classList.remove("map--blend-topo");
    };
  }, [map]);
  return null;
}

export default function TopoLayer() {
  return (
    <>
      <OfflineAwareTileLayer
        attribution={TOPOWEBB_ATTRIBUTION}
        url={TOPOWEBB_URL}
        maxZoom={19}
        maxNativeZoom={TOPOWEBB_MAX_NATIVE_ZOOM}
        enlargeParentAbove={TOPOWEBB_FULL_ZOOM}
        hasTile={hostedTile}
        skipTile={NORWAY_TOPO_URL ? tileInNorwayOnly : undefined}
        className="topo-lm"
        {...SMOOTH}
      />
      {NORWAY_TOPO_URL && (
        // Norway on top of Lantmäteriet's white beyond the border (transparent over Sweden).
        <OfflineAwareTileLayer
          attribution={NORWAY_TOPO_ATTRIBUTION}
          url={NORWAY_TOPO_URL}
          minZoom={NORWAY_MIN_ZOOM}
          maxZoom={19}
          maxNativeZoom={NORWAY_MAX_NATIVE_ZOOM}
          enlargeParentAbove={TOPOWEBB_FULL_ZOOM}
          zIndex={2}
          {...SMOOTH}
        />
      )}
      {NORWAY_TOPO_URL && <BorderBlend />}
    </>
  );
}
