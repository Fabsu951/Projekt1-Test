import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadArea, offlineBounds, removeArea, savedArea, tilesFor } from "./offlineMap";

/** Minimal Cache Storage stand-in, keyed by cache name then URL. */
function fakeCaches() {
  const store = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const cache = store.get(name)!;
    return {
      match: async (url: string) => cache.get(url)?.clone(),
      put: async (url: string, res: Response) => void cache.set(url, res),
    };
  };
  return {
    store,
    api: {
      open,
      delete: async (name: string) => store.delete(name),
      match: async (url: string) => {
        for (const cache of store.values()) if (cache.has(url)) return cache.get(url)!.clone();
        return undefined;
      },
    },
  };
}

const KEBNEKAISE = { id: "kebnekaisefjallen", lat: 67.9, lon: 18.55 };
const url = (z: number, x: number, y: number) => `https://w.example/tiles/topowebb/${z}/${x}/${y}.png`;

let caches: ReturnType<typeof fakeCaches>;
beforeEach(() => {
  localStorage.clear();
  caches = fakeCaches();
  vi.stubGlobal("caches", caches.api);
});

describe("tilesFor", () => {
  it("covers the square around the region at every zoom, more tiles further in", () => {
    const tiles = tilesFor(offlineBounds(KEBNEKAISE), 14);
    const perZoom = (z: number) => tiles.filter((t) => t[0] === z).length;
    expect(Math.min(...tiles.map((t) => t[0]))).toBe(8);
    expect(perZoom(14)).toBeGreaterThan(perZoom(13) * 3);
    expect(new Set(tiles.map((t) => t.join("/"))).size).toBe(tiles.length);
  });
});

describe("downloadArea", () => {
  it("stores every tile, reports progress, and remembers the saved area", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(100)));
    vi.stubGlobal("fetch", fetchMock);
    const progress: number[] = [];
    const area = await downloadArea(KEBNEKAISE, "oversikt", url, (p) => progress.push(p.done));

    const expected = tilesFor(offlineBounds(KEBNEKAISE), 13).length;
    expect(fetchMock).toHaveBeenCalledTimes(expected);
    expect(caches.store.get("fjallkoll-tiles-kebnekaisefjallen")!.size).toBe(expected);
    expect(progress.at(-1)).toBe(expected);
    expect(area).toMatchObject({ level: "oversikt", tiles: expected, bytes: expected * 100 });
    expect(await savedArea(KEBNEKAISE.id)).toMatchObject({ level: "oversikt", tiles: expected });
  });

  it("doesn't fetch tiles it already has when updating", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(10))));
    await downloadArea(KEBNEKAISE, "oversikt", url, () => {});
    const again = vi.fn(async () => new Response(new Uint8Array(10)));
    vi.stubGlobal("fetch", again);
    await downloadArea(KEBNEKAISE, "oversikt", url, () => {});
    expect(again).not.toHaveBeenCalled();
  });

  it("fails clearly when many tiles can't be fetched, e.g. offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(downloadArea(KEBNEKAISE, "oversikt", url, () => {})).rejects.toThrow(/kunde inte hämtas/);
    expect(await savedArea(KEBNEKAISE.id)).toBeNull();
  });

  it("removes the area's tiles and record", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(10))));
    await downloadArea(KEBNEKAISE, "oversikt", url, () => {});
    await removeArea(KEBNEKAISE.id);
    expect(caches.store.has("fjallkoll-tiles-kebnekaisefjallen")).toBe(false);
    expect(await savedArea(KEBNEKAISE.id)).toBeNull();
  });
});

describe("tileCount", () => {
  it("matches the length of the tile list without building it", async () => {
    const { tileCount, tilesFor, offlineBounds, viewPlan } = await import("./offlineMap");
    const bounds = offlineBounds({ lat: 67.9, lon: 18.55 });
    expect(tileCount(bounds, 14)).toBe(tilesFor(bounds, 14).length);
    // The whole fjällen at once: millions of tiles at zoom 15, counted instantly;
    // saving that view drops to the most detailed zoom that stays small enough.
    const fjallen = { north: 69.5, south: 61, west: 11, east: 24 };
    expect(tileCount(fjallen, 15)).toBeGreaterThan(1_000_000);
    expect(viewPlan(fjallen)?.maxZoom).toBe(10);
    expect(viewPlan({ north: 75, south: 50, west: 0, east: 40 })).toBeNull();
  });
});
