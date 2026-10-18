import { afterEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";

const WORKER = "https://w.example";
const DIRECT = "https://kartor.example";

async function layerWithBucket(bucketAnswers: boolean) {
  vi.stubEnv("VITE_MAP_PROXY_URL", WORKER);
  vi.stubEnv("VITE_TILE_DIRECT_URL", DIRECT);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      bucketAnswers ? new Response(new Uint8Array([0x89]), { headers: { "Content-Type": "image/png" } }) : Promise.reject(new TypeError("no host"))
    )
  );
  vi.resetModules();
  const { OfflineTileLayer } = await import("./offlineTileLayer");
  const offline = await import("../services/offlineMap");
  vi.spyOn(offline, "knownNoSavedTiles").mockReturnValue(true);
  const layer = new OfflineTileLayer(`${WORKER}/tiles/topowebb/{z}/{x}/{y}.png`);
  (layer as unknown as { _tileZoom: number })._tileZoom = 15;
  return layer;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OfflineTileLayer with the map bucket", () => {
  it("loads from the bucket and falls back to the worker once if that fails", async () => {
    const layer = await layerWithBucket(true);
    const done = vi.fn();
    const coords = Object.assign(L.point(18073, 7863), { z: 15 }) as L.Coords;
    const tile = layer.createTile(coords, done) as HTMLImageElement;
    await settle();
    await settle();
    expect(tile.src).toBe(`${DIRECT}/topowebb/15/18073/7863.png`);

    tile.dispatchEvent(new Event("error"));
    expect(tile.src).toBe(`${WORKER}/tiles/topowebb/15/18073/7863.png`);
    expect(done).not.toHaveBeenCalled();

    tile.dispatchEvent(new Event("error"));
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toBeTruthy();
  });

  it("uses the worker when the bucket doesn't answer", async () => {
    const layer = await layerWithBucket(false);
    const done = vi.fn();
    const coords = Object.assign(L.point(18073, 7863), { z: 15 }) as L.Coords;
    const tile = layer.createTile(coords, done) as HTMLImageElement;
    await settle();
    await settle();
    expect(tile.src).toBe(`${WORKER}/tiles/topowebb/15/18073/7863.png`);
    tile.dispatchEvent(new Event("error"));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
