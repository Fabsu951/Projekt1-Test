import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import type { TileLayerProps } from "react-leaflet";
import { OfflineTileLayer } from "./offlineTileLayer";
import { TOPOWEBB_ATTRIBUTION, TOPOWEBB_MAX_NATIVE_ZOOM, TOPOWEBB_URL } from "../services/mapTiles";

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

export default function TopoLayer() {
  return (
    <OfflineAwareTileLayer
      attribution={TOPOWEBB_ATTRIBUTION}
      url={TOPOWEBB_URL}
      maxZoom={19}
      maxNativeZoom={TOPOWEBB_MAX_NATIVE_ZOOM}
      // Keep more tiles around the view so panning back doesn't flash empty,
      // and don't fetch new tiles mid-zoom (they're thrown away at the end).
      keepBuffer={4}
      updateWhenZooming={false}
    />
  );
}
