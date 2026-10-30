import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeTiles } from "./tileBatch";
import { cleanupOldTiles, migrateTiles, publicKeyFor, publicTileKey, saveSlopeMeta, serveSlopeTile, serveTile, slopeMeta, uploadTiles, type TilesEnv } from "./tiles";

const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, n]);

/** Enough of R2 for the tile code: get/head/put/list with metadata. */
function memoryBucket(initial: Record<string, Uint8Array> = {}) {
  const store = new Map<string, { data: Uint8Array; meta: R2HTTPMetadata }>();
  for (const [k, v] of Object.entries(initial)) store.set(k, { data: v, meta: { contentType: "image/png" } });
  const object = (key: string) => {
    const v = store.get(key);
    if (!v) return null;
    return {
      key,
      size: v.data.length,
      body: v.data,
      httpMetadata: v.meta,
      arrayBuffer: async () => v.data.slice().buffer,
    };
  };
  return {
    store,
    get: async (key: string) => object(key),
    head: async (key: string) => object(key),
    put: async (key: string, value: Uint8Array | ArrayBuffer | string, opts?: { httpMetadata?: R2HTTPMetadata }) => {
      const data = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
      store.set(key, { data, meta: opts?.httpMetadata ?? {} });
    },
    list: async ({ prefix = "", cursor, limit = 1000 }: { prefix?: string; cursor?: string; limit?: number }) => {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map((key) => ({ key, size: store.get(key)!.data.length })), truncated, cursor: truncated ? String(start + limit) : undefined };
    },
    delete: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
  };
}

function context() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext,
    settle: () => Promise.all(pending),
  };
}

const bytes = async (res: Response) => [...new Uint8Array(await res.arrayBuffer())];
const migrate = (env: TilesEnv, body: unknown, token = "hemlig") =>
  migrateTiles(
    new Request("https://w.test/admin/tiles/migrate", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }),
    env,
    "*"
  );

beforeEach(() => {
  vi.stubGlobal("caches", { default: { match: async () => undefined, put: async () => undefined } });
});
afterEach(() => vi.unstubAllGlobals());

describe("public map bucket", () => {
  it("serves tiles from the public bucket, with a cache lifetime", async () => {
    const tiles = memoryBucket();
    await tiles.put(publicTileKey(15, 18076, 7868), png(7), { httpMetadata: { contentType: "image/png" } });
    const env = { IMAGES: memoryBucket(), TILES: tiles } as unknown as TilesEnv;
    const { ctx } = context();
    const res = await serveTile(new Request("https://w.test/tiles/topowebb/15/18076/7868.png"), env, ctx, "*", { z: 15, x: 18076, y: 7868 });
    expect(res.status).toBe(200);
    expect(await bytes(res)).toEqual([...png(7)]);
    expect(res.headers.get("Cache-Control")).toMatch(/max-age=\d+/);
  });

  it("still finds tiles in their old place and copies them to the public bucket", async () => {
    const images = memoryBucket({ "maptiles/topowebb/15/18076/7868": png(3) });
    const tiles = memoryBucket();
    const env = { IMAGES: images, TILES: tiles } as unknown as TilesEnv;
    const { ctx, settle } = context();
    const res = await serveTile(new Request("https://w.test/tiles/topowebb/15/18076/7868.png"), env, ctx, "*", { z: 15, x: 18076, y: 7868 });
    expect(await bytes(res)).toEqual([...png(3)]);
    await settle();
    const copy = tiles.store.get("topowebb/15/18076/7868.png");
    expect(copy && [...copy.data]).toEqual([...png(3)]);
    expect(copy?.meta).toMatchObject({ contentType: "image/png", cacheControl: expect.stringMatching(/^public, max-age=\d+$/) });
  });

  it("falls back to OpenStreetMap for tiles it doesn't have", async () => {
    const env = { IMAGES: memoryBucket(), TILES: memoryBucket() } as unknown as TilesEnv;
    const res = await serveTile(new Request("https://w.test/tiles/topowebb/15/1/1.png"), env, context().ctx, "*", { z: 15, x: 1, y: 1 });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://tile.openstreetmap.org/15/1/1.png");
  });

  it("answers 404 for a missing zoom-16 tile, so the app enlarges zoom 15 instead", async () => {
    const tiles = memoryBucket();
    await tiles.put(publicTileKey(16, 36152, 15736), png(5), { httpMetadata: { contentType: "image/png" } });
    const env = { IMAGES: memoryBucket(), TILES: tiles } as unknown as TilesEnv;
    const hit = await serveTile(new Request("https://w.test/tiles/topowebb/16/36152/15736.png"), env, context().ctx, "*", { z: 16, x: 36152, y: 15736 });
    expect(await bytes(hit)).toEqual([...png(5)]);
    const miss = await serveTile(new Request("https://w.test/tiles/topowebb/16/2/2.png"), env, context().ctx, "*", { z: 16, x: 2, y: 2 });
    expect(miss.status).toBe(404);
  });

  it("stores uploads in the public bucket only", async () => {
    const images = memoryBucket();
    const tiles = memoryBucket();
    const env = { IMAGES: images, TILES: tiles, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;
    const body = encodeTiles([{ z: 15, x: 18076, y: 7868, data: png(1) }]);
    const post = (layer: "topowebb" | "slope") =>
      uploadTiles(new Request(`https://w.test/admin/tiles/${layer}`, { method: "POST", headers: { Authorization: "Bearer hemlig" }, body }), env, "*", layer);
    expect((await post("topowebb")).status).toBe(200);
    expect((await post("slope")).status).toBe(200);
    expect([...tiles.store.keys()].sort()).toEqual(["slope/15/18076/7868.png", "topowebb/15/18076/7868.png"]);
    expect(images.store.size).toBe(0);
  });

  it("keeps the slope map and its meta in the public bucket, reading the old place too", async () => {
    const images = memoryBucket({ "maptiles/slope/13/4520/1967": png(9) });
    const tiles = memoryBucket();
    const env = { IMAGES: images, TILES: tiles, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;
    const tile = await serveSlopeTile(new Request("https://w.test/tiles/slope/13/4520/1967.png"), env, context().ctx, "*", { z: 13, x: 4520, y: 1967 });
    expect(await bytes(tile)).toEqual([...png(9)]);
    const meta = new Request("https://w.test/admin/tiles/slope/meta", { method: "POST", headers: { Authorization: "Bearer hemlig" }, body: '{"minZoom":12}' });
    expect((await saveSlopeMeta(meta, env, "*")).status).toBe(200);
    expect(tiles.store.has("slope/meta.json")).toBe(true);
    expect(await (await slopeMeta(env, "*")).json()).toEqual({ minZoom: 12 });
  });
});

describe("moving tiles to the public bucket", () => {
  it("maps old keys to public paths and ignores anything else", () => {
    expect(publicKeyFor("maptiles/topowebb/7/70/32")).toBe("topowebb/7/70/32.png");
    expect(publicKeyFor("maptiles/slope/15/18076/7868")).toBe("slope/15/18076/7868.png");
    expect(publicKeyFor("maptiles/slope/_meta.json")).toBe("slope/meta.json");
    expect(publicKeyFor("backups/d1/2026-10-12.json.gz")).toBeNull();
    expect(publicKeyFor("tracks/abc.json")).toBeNull();
    expect(publicKeyFor("maptiles/topowebb/7/70/32/../../x")).toBeNull();
  });

  it("lists what is where, copies only map tiles, and never overwrites", async () => {
    const images = memoryBucket({
      "maptiles/topowebb/0/0/0": png(0),
      "maptiles/topowebb/7/70/32": png(1),
      "maptiles/topowebb/15/18076/7868": png(2),
      "maptiles/slope/15/18076/7868": png(3),
      "tracks/hemlig.json": png(4),
      "backups/d1/2026-10-12.json.gz": png(5),
    });
    const tiles = memoryBucket();
    await tiles.put("topowebb/7/70/32.png", png(99), { httpMetadata: { contentType: "image/png" } }); // newer, keep it
    const env = { IMAGES: images, TILES: tiles, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;

    expect((await migrate(env, { list: "old" }, "fel")).status).toBe(401);
    const old = (await (await migrate(env, { list: "old" })).json()) as { keys: string[]; cursor: string | null };
    expect(old.keys).toEqual([
      "maptiles/slope/15/18076/7868",
      "maptiles/topowebb/0/0/0",
      "maptiles/topowebb/15/18076/7868",
      "maptiles/topowebb/7/70/32",
    ]);
    expect(old.cursor).toBeNull();
    const fresh = (await (await migrate(env, { list: "new" })).json()) as { keys: string[] };
    expect(fresh.keys).toEqual(["topowebb/7/70/32.png"]);

    // Keys outside maptiles/ are never copied, even if asked for.
    const res = await migrate(env, { keys: [...old.keys, "tracks/hemlig.json", "backups/d1/2026-10-12.json.gz"] });
    expect(await res.json()).toEqual({ copied: 3, skipped: 3 });
    expect([...tiles.store.keys()].sort()).toEqual([
      "slope/15/18076/7868.png",
      "topowebb/0/0/0.png",
      "topowebb/15/18076/7868.png",
      "topowebb/7/70/32.png",
    ]);
    expect([...tiles.store.get("topowebb/7/70/32.png")!.data]).toEqual([...png(99)]);
    expect(tiles.store.get("topowebb/0/0/0.png")!.meta.cacheControl).toMatch(/^public, max-age=/);
    expect((await migrate(env, { keys: Array.from({ length: 51 }, () => "maptiles/topowebb/0/0/0") })).status).toBe(400);
  });

  it("lists both buckets with sizes and deletes only old tile keys", async () => {
    const images = memoryBucket({
      "maptiles/topowebb/15/1/1": png(4),
      "maptiles/topowebb/15/1/2": png(4),
      "tracks/abc.json": png(9),
      "avatar/xyz": png(9),
    });
    const tiles = memoryBucket();
    await tiles.put(publicTileKey(15, 1, 1), png(4));
    const env = { IMAGES: images, TILES: tiles, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;
    const call = (body: unknown, token = "hemlig") =>
      cleanupOldTiles(new Request("https://w.test/admin/tiles/cleanup", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }), env, "*");

    expect((await call({ list: "old" }, "fel")).status).toBe(401);
    expect(await (await call({ list: "old" })).json()).toEqual({ objects: [["maptiles/topowebb/15/1/1", 5], ["maptiles/topowebb/15/1/2", 5]], cursor: null });
    expect(await (await call({ list: "new" })).json()).toEqual({ objects: [["topowebb/15/1/1.png", 5]], cursor: null });

    expect((await call({ delete: ["tracks/abc.json"] })).status).toBe(400);
    expect((await call({ delete: ["maptiles/topowebb/15/1/1", "avatar/xyz"] })).status).toBe(400);
    expect(images.store.size).toBe(4);
    expect(await (await call({ delete: ["maptiles/topowebb/15/1/1"] })).json()).toEqual({ deleted: 1 });
    expect([...images.store.keys()].sort()).toEqual(["avatar/xyz", "maptiles/topowebb/15/1/2", "tracks/abc.json"]);
  });
});
