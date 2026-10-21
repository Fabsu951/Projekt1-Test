import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKER = "https://w.example";
const DIRECT = "https://kartor.example";
const workerTile = (z: number, x: number, y: number) => `${WORKER}/tiles/topowebb/${z}/${x}/${y}.png`;
// Kebnekaise at zoom 15, and Stockholm (outside the mountain boxes).
const KEBNE = [15, 18073, 7863] as const;
const STHLM = [15, 18017, 9619] as const;

async function load(direct = DIRECT) {
  vi.stubEnv("VITE_MAP_PROXY_URL", WORKER);
  vi.stubEnv("VITE_TILE_DIRECT_URL", direct);
  vi.resetModules();
  return import("./mapTiles");
}

const pngResponse = () => new Response(new Uint8Array([0x89, 0x50]), { headers: { "Content-Type": "image/png" } });

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("tiles from the map bucket", () => {
  it("knows which tiles the bucket has", async () => {
    const { hostedTile } = await load();
    expect(hostedTile(0, 0, 0)).toBe(true);
    expect(hostedTile(7, 70, 30)).toBe(true);
    expect(hostedTile(...KEBNE)).toBe(true);
    expect(hostedTile(...STHLM)).toBe(false);
    expect(hostedTile(16, KEBNE[1] * 2, KEBNE[2] * 2)).toBe(false);
  });

  it("maps worker tile URLs to the bucket, only for tiles it has", async () => {
    const { directTileFor } = await load();
    expect(directTileFor(workerTile(...KEBNE))).toBe(`${DIRECT}/topowebb/15/18073/7863.png`);
    expect(directTileFor(workerTile(...STHLM))).toBeNull();
    expect(directTileFor(`${WORKER}/tiles/slope/13/4518/1965.png`)).toBe(`${DIRECT}/slope/13/4518/1965.png`);
    expect(directTileFor(`${WORKER}/terrain/lutning/13/1/1.png`)).toBeNull();
  });

  it("does nothing without a bucket address", async () => {
    const { directTileFor, networkTileUrl } = await load("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(directTileFor(workerTile(...KEBNE))).toBeNull();
    expect(await networkTileUrl(workerTile(...KEBNE))).toBe(workerTile(...KEBNE));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the bucket once it answers with a tile, asking only once", async () => {
    const fetchMock = vi.fn(async (_url: string) => pngResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { networkTileUrl } = await load();
    expect(await networkTileUrl(workerTile(...KEBNE))).toBe(`${DIRECT}/topowebb/15/18073/7863.png`);
    expect(await networkTileUrl(workerTile(...STHLM))).toBe(workerTile(...STHLM));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${DIRECT}/topowebb/0/0/0.png`);
  });

  it("stays with the worker while the bucket doesn't answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("no such host"); }));
    const { networkTileUrl } = await load();
    expect(await networkTileUrl(workerTile(...KEBNE))).toBe(workerTile(...KEBNE));
    // An error page (not an image) counts as not answering too.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { headers: { "Content-Type": "text/html" } })));
    const again = await load();
    expect(await again.networkTileUrl(workerTile(...KEBNE))).toBe(workerTile(...KEBNE));
  });

  it("shows tiles from the bucket at once, and from the worker once the bucket is known to be down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("no such host"); }));
    const { quickTileUrl, directTilesReady } = await load();
    // Before the check has answered: the bucket (the map layer falls back per tile).
    expect(quickTileUrl(workerTile(...KEBNE))).toBe(`${DIRECT}/topowebb/15/18073/7863.png`);
    expect(quickTileUrl(workerTile(...STHLM))).toBe(workerTile(...STHLM));
    await directTilesReady();
    expect(quickTileUrl(workerTile(...KEBNE))).toBe(workerTile(...KEBNE));
  });
});

describe("offline download with the map bucket", () => {
  it("saves tiles under the worker URL, using the worker when the bucket lacks one", async () => {
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async (u: string) => store.get(u)?.clone(),
        put: async (u: string, r: Response) => void store.set(u, r),
      }),
      keys: async () => [],
    });
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        asked.push(u);
        if (u.startsWith(DIRECT) && u.endsWith("/7864.png")) return new Response("", { status: 404 });
        return pngResponse();
      })
    );
    const { topoTileUrl } = await load();
    const { downloadTiles } = await import("./offlineMap");
    const tiles: Array<[number, number, number]> = [[...KEBNE], [15, 18073, 7864], [...STHLM]];
    const result = await downloadTiles("fjallkoll-tiles-test", tiles, topoTileUrl, () => {});
    expect(result.tiles).toBe(3);
    expect([...store.keys()].sort()).toEqual(tiles.map(([z, x, y]) => workerTile(z, x, y)).sort());
    expect(asked).toContain(`${DIRECT}/topowebb/15/18073/7863.png`);
    expect(asked).toContain(`${DIRECT}/topowebb/15/18073/7864.png`);
    expect(asked).toContain(workerTile(15, 18073, 7864)); // the fallback
    expect(asked).not.toContain(workerTile(...KEBNE));
    expect(asked).toContain(workerTile(...STHLM)); // not in the bucket: worker straight away
  });
});
