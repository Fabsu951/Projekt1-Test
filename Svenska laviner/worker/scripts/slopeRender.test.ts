import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { band, encodeBandsPng, mergeChildren, metresPerPixel, renderSlopeTile, TILE_SIZE } from "./slopeRender";

// A plane tilted to the east: height rises `tan(angle)` metres per metre of easting.
const plane = (degrees: number) => (east: number) => Math.tan((degrees * Math.PI) / 180) * east;
// Treat lon/lat as metres directly (scaled) – enough to test the slope maths.
const flatProject = (lon: number, lat: number): [number, number] => [lon * 111_000 * Math.cos((68 * Math.PI) / 180), lat * 111_000];

describe("slope tiles from a height model", () => {
  it("bands like the app's slope layer", () => {
    expect([band(10), band(29.9), band(30), band(37), band(44.9), band(50)]).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it("finds the angle of a tilted plane and leaves gentle ground transparent", () => {
    // z15 tile near Kebnekaise.
    const z = 15, x = 18_066, y = 7_548;
    const steep = renderSlopeTile(z, x, y, (e) => plane(37)(e), flatProject)!;
    expect(new Set(steep)).toEqual(new Set([2]));
    expect(renderSlopeTile(z, x, y, (e) => plane(20)(e), flatProject)).toBeNull();
  });

  it("leaves pixels without height data transparent", () => {
    const tile = renderSlopeTile(15, 18_066, 7_548, (e) => (e % 200 < 100 ? plane(42)(e) : null), flatProject)!;
    expect(tile.some((v) => v === 0)).toBe(true);
    expect(tile.some((v) => v === 3)).toBe(true);
  });

  it("keeps the steepest band when zooming out", () => {
    const a = new Uint8Array(TILE_SIZE * TILE_SIZE);
    a[0] = 4; // one steep pixel in the top-left child
    const merged = mergeChildren([a, null, null, null])!;
    expect(merged[0]).toBe(4);
    expect(merged[1]).toBe(0);
    expect(mergeChildren([null, null, null, null])).toBeNull();
  });

  it("writes a valid palette PNG with transparency", () => {
    const bands = new Uint8Array(TILE_SIZE * TILE_SIZE).fill(1);
    const png = encodeBandsPng(bands);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const text = Buffer.from(png).toString("latin1");
    expect(text).toContain("PLTE");
    expect(text).toContain("tRNS");
    const start = text.indexOf("IDAT") + 4;
    const length = new DataView(png.buffer).getUint32(start - 8);
    const raw = inflateSync(png.subarray(start, start + length));
    expect(raw.length).toBe(TILE_SIZE * (TILE_SIZE + 1));
    expect(raw[1]).toBe(1);
  });

  it("knows how big a pixel is", () => {
    expect(metresPerPixel(68, 15)).toBeCloseTo(1.79, 1);
  });
});
