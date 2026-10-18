import L from "leaflet";
import "./leafletFixes";
import { cachedTile, knownNoSavedTiles } from "../services/offlineMap";

type TileDone = (error: Error | undefined, tile: HTMLElement) => void;
interface TileHandlers {
  _tileOnLoad(done: TileDone, tile: HTMLElement): void;
  _tileOnError(done: TileDone, tile: HTMLElement, e: Error): void;
}

/**
 * A tile layer that shows tiles saved for offline use when there are any,
 * and loads the rest from the network as usual.
 */
export class OfflineTileLayer extends L.TileLayer {
  createTile(coords: L.Coords, done: TileDone): HTMLElement {
    const tile = document.createElement("img");
    const handlers = this as unknown as TileHandlers;
    L.DomEvent.on(tile, "load", () => handlers._tileOnLoad(done, tile));
    L.DomEvent.on(tile, "error", (e) => handlers._tileOnError(done, tile, e as unknown as Error));
    tile.alt = "";
    tile.setAttribute("role", "presentation");

    const url = this.getTileUrl(coords);
    // Nothing saved on this device: load straight away, no lookup.
    if (knownNoSavedTiles()) {
      tile.src = url;
      return tile;
    }
    void cachedTile(url).then(async (saved) => {
      if (!saved) {
        tile.src = url;
        return;
      }
      const objectUrl = URL.createObjectURL(await saved.blob());
      tile.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
      tile.src = objectUrl;
    });
    return tile;
  }
}
