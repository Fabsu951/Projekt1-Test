import { describe, expect, it } from "vitest";
import { decodeTiles, encodeTiles, imageType, validTile } from "./tileBatch";
import { HALF_WORLD, mapLevel } from "./gpkgTiles";
import { fetchable, parseTilePath } from "./tiles";

const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, n]);

describe("tile batches", () => {
  it("round-trips tiles through the upload format", () => {
    const tiles = [
      { z: 15, x: 17871, y: 7520, data: png(1) },
      { z: 3, x: 4, y: 2, data: png(2) },
    ];
    const decoded = decodeTiles(encodeTiles(tiles).buffer as ArrayBuffer);
    expect(decoded.map((t) => [t.z, t.x, t.y, [...t.data]])).toEqual(tiles.map((t) => [t.z, t.x, t.y, [...t.data]]));
  });

  it("rejects a truncated batch", () => {
    const bytes = encodeTiles([{ z: 1, x: 0, y: 0, data: png(1) }]);
    expect(() => decodeTiles(bytes.slice(0, bytes.length - 1).buffer as ArrayBuffer)).toThrow();
  });

  it("knows PNG and JPEG, and valid coordinates", () => {
    expect(imageType(png(0))).toBe("image/png");
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe("image/jpeg");
    expect(imageType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(validTile(2, 3, 3)).toBe(true);
    expect(validTile(2, 4, 0)).toBe(false);
    expect(validTile(18, 0, 0)).toBe(false);
  });
});

describe("parseTilePath", () => {
  it("accepts z/x/y tile paths within range only", () => {
    expect(parseTilePath("/tiles/topowebb/15/17871/7520.png")).toEqual({ z: 15, x: 17871, y: 7520 });
    expect(parseTilePath("/tiles/topowebb/2/4/0.png")).toBeNull();
    expect(parseTilePath("/tiles/topowebb/15/1/1.jpg")).toBeNull();
    expect(parseTilePath("/tiles/other/1/0/0.png")).toBeNull();
  });
});

describe("mapLevel", () => {
  const world = { srs: 3857, minX: -HALF_WORLD, maxY: HALF_WORLD };

  it("maps a full-world pyramid level straight onto z/x/y", () => {
    const pixel = (2 * HALF_WORLD) / 256 / 2 ** 15;
    expect(mapLevel(world, { zoomLevel: 15, tileWidth: 256, tileHeight: 256, pixelXSize: pixel, pixelYSize: pixel })).toEqual({
      gpkgLevel: 15,
      z: 15,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("finds the zoom and offsets of a pyramid cut out around Kebnekaise", () => {
    const z = 13;
    const span = (2 * HALF_WORLD) / 2 ** z;
    const set = { srs: 3857, minX: -HALF_WORLD + 4466 * span, maxY: HALF_WORLD - 1878 * span };
    const pixel = span / 256;
    expect(mapLevel(set, { zoomLevel: 4, tileWidth: 256, tileHeight: 256, pixelXSize: pixel, pixelYSize: pixel })).toEqual({
      gpkgLevel: 4,
      z: 13,
      offsetX: 4466,
      offsetY: 1878,
    });
  });

  it("refuses SWEREF 99 TM and misaligned pyramids", () => {
    const pixel = (2 * HALF_WORLD) / 256 / 2 ** 10;
    const matrix = { zoomLevel: 10, tileWidth: 256, tileHeight: 256, pixelXSize: pixel, pixelYSize: pixel };
    expect(() => mapLevel({ ...world, srs: 3006 }, matrix)).toThrow(/3857/);
    expect(() => mapLevel({ ...world, minX: -HALF_WORLD + 1234 }, matrix)).toThrow();
    expect(() => mapLevel(world, { ...matrix, pixelXSize: pixel * 1.5, pixelYSize: pixel * 1.5 })).toThrow();
  });
});

describe("fetchable", () => {
  it("fetches tiles over Sweden up to zoom 15, and the whole world at low zoom", () => {
    expect(fetchable(15, 18072, 7520)).toBe(true); // Kebnekaise area
    expect(fetchable(3, 0, 0)).toBe(true);
    expect(fetchable(16, 35742, 15040)).toBe(false); // too deep
    expect(fetchable(12, 0, 0)).toBe(false); // far outside Sweden
    expect(fetchable(10, 300, 300)).toBe(false); // Africa-ish
  });
});
