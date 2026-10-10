import { describe, expect, it } from "vitest";
import { encodeTiles } from "./tileBatch";
import { parseSlopePath, saveSlopeMeta, slopeMeta, uploadTiles, type TilesEnv } from "./tiles";

function memoryBucket() {
  const store = new Map<string, Uint8Array | string>();
  return {
    store,
    put: async (key: string, value: Uint8Array | string) => void store.set(key, value),
    get: async (key: string) => {
      const v = store.get(key);
      return v === undefined ? null : { body: typeof v === "string" ? v : v, httpMetadata: { contentType: "image/png" } };
    },
  };
}

describe("detailed slope map", () => {
  it("serves zoom 12–15 only", () => {
    expect(parseSlopePath("/tiles/slope/15/18076/7868.png")).toEqual({ z: 15, x: 18076, y: 7868 });
    expect(parseSlopePath("/tiles/slope/11/1/1.png")).toBeNull();
    expect(parseSlopePath("/tiles/slope/16/1/1.png")).toBeNull();
  });

  it("stores uploaded tiles under their own prefix and only with the upload token", async () => {
    const bucket = memoryBucket();
    const env = { IMAGES: bucket, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;
    const body = encodeTiles([{ z: 15, x: 18076, y: 7868, data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]) }]);
    const post = (token: string) =>
      new Request("https://w.test/admin/tiles/slope", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    expect((await uploadTiles(post("fel"), env, "*", "slope")).status).toBe(401);
    expect((await uploadTiles(post("hemlig"), env, "*", "slope")).status).toBe(200);
    expect([...bucket.store.keys()]).toEqual(["maptiles/slope/15/18076/7868"]);
  });

  it("says whether the map exists", async () => {
    const bucket = memoryBucket();
    const env = { IMAGES: bucket, TILE_UPLOAD_TOKEN: "hemlig" } as unknown as TilesEnv;
    expect((await slopeMeta(env, "*")).status).toBe(404);
    const meta = new Request("https://w.test/admin/tiles/slope/meta", {
      method: "POST",
      headers: { Authorization: "Bearer hemlig" },
      body: JSON.stringify({ updated: "2026-10-10", minZoom: 12, maxZoom: 15 }),
    });
    expect((await saveSlopeMeta(meta, env, "*")).status).toBe(200);
    const res = await slopeMeta(env, "*");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ minZoom: 12, maxZoom: 15 });
  });
});
