import { describe, expect, it } from "vitest";
import { corridorTiles, tilesFor } from "./offlineMap";
import { routeTiles } from "./offlineRoutes";

describe("offline route tiles", () => {
  it("covers a corridor along the route, far fewer tiles than its bounding box", () => {
    // An L-shaped 10 + 10 km route near Kebnekaise.
    const route: Array<[number, number]> = [[67.85, 18.4], [67.94, 18.4], [67.94, 18.64]];
    const tiles = routeTiles(route);
    const z15 = tiles.filter(([z]) => z === 15);
    const zooms = new Set(tiles.map(([z]) => z));
    expect([...zooms].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    // The rectangle around the route plus the same 1.5 km margin, for comparison.
    const pad = 1.5 / 111.2;
    const box = tilesFor({ north: 67.94 + pad, south: 67.85 - pad, west: 18.4 - pad / 0.377, east: 18.64 + pad / 0.377 }, 15)
      .filter(([z]) => z === 15);
    expect(z15.length).toBeGreaterThan(100);
    expect(z15.length).toBeLessThan(box.length * 0.6);
    expect(new Set(tiles.map((t) => t.join("/"))).size).toBe(tiles.length); // no duplicates
  });

  it("includes the tiles under every point of the line", () => {
    const tiles = corridorTiles([[67.85, 18.4], [67.9, 18.5]], 0, 14, 14);
    const tile = (lat: number, lon: number) => {
      const n = 2 ** 14;
      const x = Math.floor(((lon + 180) / 360) * n);
      const r = (lat * Math.PI) / 180;
      const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
      return `14/${x}/${y}`;
    };
    const have = new Set(tiles.map((t) => t.join("/")));
    for (let i = 0; i <= 10; i++) expect(have.has(tile(67.85 + 0.005 * i, 18.4 + 0.01 * i))).toBe(true);
  });
});
