import L from "leaflet";
import "./leafletFixes";
import { cachedTile, knownNoSavedTiles } from "../services/offlineMap";
import { directTilesReady, quickTileUrl } from "../services/mapTiles";

// Ask early whether kartor.snolage.se answers, so the first tiles don't wait.
void directTilesReady();

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
    // Set when the tile comes from the map bucket: if that fails, try once
    // more through the worker before giving up.
    let fallback: string | null = null;
    L.DomEvent.on(tile, "load", () => handlers._tileOnLoad(done, tile));
    L.DomEvent.on(tile, "error", (e) => {
      if (fallback) {
        tile.src = fallback;
        fallback = null;
        return;
      }
      handlers._tileOnError(done, tile, e as unknown as Error);
    });
    tile.alt = "";
    tile.setAttribute("role", "presentation");

    // The worker URL: the tile's identity, also for copies saved offline.
    const url = this.getTileUrl(coords);
    // Straight from the map bucket, without waiting for the check above; a
    // tile that fails there is fetched through the worker instead.
    const fromNetwork = () => {
      const src = quickTileUrl(url);
      if (src !== url) fallback = url;
      tile.src = src;
    };
    // Nothing saved on this device: load straight away, no lookup.
    if (knownNoSavedTiles()) {
      fromNetwork();
      return tile;
    }
    void cachedTile(url).then(async (saved) => {
      if (!saved) {
        fromNetwork();
        return;
      }
      const objectUrl = URL.createObjectURL(await saved.blob());
      tile.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
      tile.src = objectUrl;
    });
    return tile;
  }
}
