import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import type { TileLayerProps } from "react-leaflet";
import { OfflineTileLayer } from "./offlineTileLayer";
import {
  NORWAY_MIN_ZOOM,
  NORWAY_TOPO_ATTRIBUTION,
  NORWAY_TOPO_URL,
  TOPOWEBB_ATTRIBUTION,
  TOPOWEBB_MAX_NATIVE_ZOOM,
  TOPOWEBB_URL,
} from "../services/mapTiles";

/** Tiles saved for offline use (services/offlineMap.ts) are shown first when present. */
const OfflineAwareTileLayer = createTileLayerComponent<OfflineTileLayer, TileLayerProps>(
  function createTileLayer({ url, ...options }, context) {
    return createElementObject(new OfflineTileLayer(url, withPane(options, context)), context);
  },
  function updateTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.url !== prevProps.url) layer.setUrl(props.url);
  }
);

// Keep more tiles around the view so panning back doesn't flash empty,
// and load new ones while the finger still pans or pinches (tiles come
// straight from kartor.snolage.se, so this costs no worker requests).
const SMOOTH = { keepBuffer: 4, updateWhenIdle: false, updateWhenZooming: true, updateInterval: 150 } as const;

export default function TopoLayer() {
  return (
    <>
      <OfflineAwareTileLayer
        attribution={TOPOWEBB_ATTRIBUTION}
        url={TOPOWEBB_URL}
        maxZoom={19}
        maxNativeZoom={TOPOWEBB_MAX_NATIVE_ZOOM}
        {...SMOOTH}
      />
      {NORWAY_TOPO_URL && (
        // Norway on top of Lantmäteriet's white beyond the border (transparent over Sweden).
        <OfflineAwareTileLayer
          attribution={NORWAY_TOPO_ATTRIBUTION}
          url={NORWAY_TOPO_URL}
          minZoom={NORWAY_MIN_ZOOM}
          maxZoom={19}
          maxNativeZoom={TOPOWEBB_MAX_NATIVE_ZOOM}
          zIndex={2}
          {...SMOOTH}
        />
      )}
    </>
  );
}
