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
  _url: string;
}

export interface OfflineTileLayerOptions extends L.TileLayerOptions {
  /**
   * Above this zoom a tile that is missing or fails shows the one-level-up
   * tile enlarged instead (e.g. zoom 16 exists only in the mountains, or
   * isn't saved offline): never worse than enlarging that zoom everywhere.
   */
  enlargeParentAbove?: number;
  /** Whether a tile above `enlargeParentAbove` exists at all; false skips straight to the enlarged parent. */
  hasTile?: (z: number, x: number, y: number) => boolean;
}

/**
 * Shows `url` in `img`: a copy saved for offline use when there is one, else
 * the network – straight from the map bucket, falling back to the worker
 * URL (the tile's identity) once. Calls `failed` when nothing works.
 */
function loadInto(img: HTMLImageElement, url: string, failed: (e: Error) => void, loaded: () => void): void {
  let fallback: string | null = null;
  img.addEventListener("load", loaded);
  img.addEventListener("error", () => {
    if (fallback) {
      img.src = fallback;
      fallback = null;
      return;
    }
    failed(new Error(`tile ${url}`));
  });
  const fromNetwork = () => {
    const src = quickTileUrl(url);
    if (src !== url) fallback = url;
    img.src = src;
  };
  // Nothing saved on this device: load straight away, no lookup.
  if (knownNoSavedTiles()) {
    fromNetwork();
    return;
  }
  void cachedTile(url).then(async (saved) => {
    if (!saved) {
      fromNetwork();
      return;
    }
    const objectUrl = URL.createObjectURL(await saved.blob());
    img.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
    img.src = objectUrl;
  });
}

/**
 * A tile layer that shows tiles saved for offline use when there are any,
 * and loads the rest from the network as usual.
 */
export class OfflineTileLayer extends L.TileLayer {
  declare options: OfflineTileLayerOptions;

  createTile(coords: L.Coords, done: TileDone): HTMLElement {
    const handlers = this as unknown as TileHandlers;
    const enlargeAbove = this.options.enlargeParentAbove;
    if (enlargeAbove !== undefined && coords.z > enlargeAbove) return this.createEnlargeableTile(coords, done);

    const tile = document.createElement("img");
    tile.alt = "";
    tile.setAttribute("role", "presentation");
    loadInto(
      tile,
      this.getTileUrl(coords),
      (e) => handlers._tileOnError(done, tile, e),
      () => handlers._tileOnLoad(done, tile)
    );
    return tile;
  }

  /** A tile in a frame, so the parent can be shown enlarged in it when the tile itself is missing. */
  private createEnlargeableTile(coords: L.Coords, done: TileDone): HTMLElement {
    const handlers = this as unknown as TileHandlers;
    const frame = document.createElement("div");
    frame.setAttribute("role", "presentation");
    frame.style.overflow = "hidden";
    const img = document.createElement("img");
    img.alt = "";
    Object.assign(img.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", maxWidth: "none" });
    frame.appendChild(img);

    let settled = false;
    const loaded = () => {
      if (settled) return;
      settled = true;
      handlers._tileOnLoad(done, frame);
    };
    const showParent = () => {
      const fresh = document.createElement("img");
      fresh.alt = "";
      Object.assign(fresh.style, {
        position: "absolute",
        width: "200%",
        height: "200%",
        maxWidth: "none",
        left: `${-(coords.x % 2) * 100}%`,
        top: `${-(coords.y % 2) * 100}%`,
      });
      frame.replaceChildren(fresh);
      const parent = L.Util.template(handlers._url, { ...this.options, z: coords.z - 1, x: Math.floor(coords.x / 2), y: Math.floor(coords.y / 2) });
      loadInto(fresh, parent, (e) => {
        if (settled) return;
        settled = true;
        handlers._tileOnError(done, frame, e);
      }, loaded);
    };

    if (this.options.hasTile && !this.options.hasTile(coords.z, coords.x, coords.y)) {
      showParent();
    } else {
      loadInto(img, this.getTileUrl(coords), showParent, loaded);
    }
    return frame;
  }
}
