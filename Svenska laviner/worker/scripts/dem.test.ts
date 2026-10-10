import { describe, expect, it } from "vitest";
import { HeightModel, project, unproject, type DemFile, type Raster } from "./dem";

function fakeFile(name: string, minE: number, minN: number, size: number, res: number, height: (e: number, n: number) => number): DemFile {
  const width = size / res;
  const data = new Float32Array(width * width);
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) data[row * width + col] = height(minE + (col + 0.5) * res, minN + size - (row + 0.5) * res);
  }
  const raster: Raster = { bbox: [minE, minN, minE + size, minN + size], originE: minE, originN: minN + size, res, width, height: width, data, nodata: -9999 };
  return { name, bbox: raster.bbox, lonLat: [0, 0, 0, 0], open: async () => raster };
}

describe("height model", () => {
  it("projects to SWEREF 99 TM and back", () => {
    const [e, n] = project(18.55, 67.9);
    expect(e).toBeGreaterThan(600_000);
    expect(n).toBeGreaterThan(7_500_000);
    const [lon, lat] = unproject(e, n);
    expect(lon).toBeCloseTo(18.55, 6);
    expect(lat).toBeCloseTo(67.9, 6);
  });

  it("interpolates heights across two neighbouring files and knows where data ends", async () => {
    const slope = (e: number) => 0.5 * e; // 0.5 m per metre
    const model = new HeightModel([fakeFile("a", 0, 0, 100, 1, slope), fakeFile("b", 100, 0, 100, 1, slope)]);
    expect(await model.prepare([90, 10, 110, 20])).toBe(2);
    expect(model.height(50.5, 50)).toBeCloseTo(25.25, 5);
    expect(model.height(150.5, 50)).toBeCloseTo(75.25, 5);
    expect(model.height(500, 50)).toBeNull();
  });

  it("keeps only a few files in memory", async () => {
    const files = Array.from({ length: 5 }, (_, i) => fakeFile(`f${i}`, i * 100, 0, 100, 1, () => i));
    const model = new HeightModel(files, 2);
    for (let i = 0; i < 5; i++) await model.prepare([i * 100 + 10, 10, i * 100 + 20, 20]);
    expect(model.height(450, 50)).toBe(4);
    expect(model.height(50, 50)).toBeNull();
  });
});

describe("real GeoTIFF files", () => {
  it("reads position, cell size and heights from a file in a folder", async () => {
    const { writeArrayBuffer } = await import("geotiff");
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { filesInFolder } = await import("./dem");
    const width = 50;
    const values = new Float32Array(width * width);
    // Rises 1 m per metre east; 2 m cells starting at E 650 000, N 7 535 100 (north edge).
    for (let row = 0; row < width; row++) for (let col = 0; col < width; col++) values[row * width + col] = col * 2 + 1;
    const buffer = await writeArrayBuffer(values, {
      width,
      height: width,
      ModelPixelScale: [2, 2, 0],
      ModelTiepoint: [0, 0, 0, 650_000, 7_535_100, 0],
      ProjectedCSTypeGeoKey: 3006,
      GTModelTypeGeoKey: 1,
      GTRasterTypeGeoKey: 1,
      SampleFormat: [3],
      BitsPerSample: [32],
    });
    const dir = mkdtempSync(join(tmpdir(), "dem-"));
    writeFileSync(join(dir, "ruta.tif"), Buffer.from(buffer));
    const files = await filesInFolder(dir);
    expect(files).toHaveLength(1);
    expect(files[0].bbox).toEqual([650_000, 7_535_000, 650_100, 7_535_100]);
    const model = new HeightModel(files);
    await model.prepare([650_000, 7_535_000, 650_100, 7_535_100]);
    expect(model.height(650_011, 7_535_050)).toBeCloseTo(11, 4);
  });
});

describe("height files straight from Lantmäteriet", () => {
  it("fetches a STAC item's GeoTIFF with the login and reads it", async () => {
    const { writeArrayBuffer } = await import("geotiff");
    const { filesFromStac } = await import("./dem");
    const values = new Float32Array(10 * 10).fill(500);
    const buffer = await writeArrayBuffer(values, {
      width: 10,
      height: 10,
      ModelPixelScale: [1, 1, 0],
      ModelTiepoint: [0, 0, 0, 650_000, 7_535_010, 0],
      ProjectedCSTypeGeoKey: 3006,
      SampleFormat: [3],
      BitsPerSample: [32],
    });
    const seen: Array<string | null> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response(buffer);
    }) as typeof fetch;
    try {
      const [file] = filesFromStac(
        [{ id: "ruta", bbox: [17, 67.9, 17.1, 68], assets: { data: { href: "https://example.invalid/ruta.tif", type: "image/tiff; application=geotiff" } } }],
        "Basic abc"
      );
      const raster = await file.open();
      expect(raster.bbox).toEqual([650_000, 7_535_000, 650_010, 7_535_010]);
      expect(raster.data[0]).toBe(500);
      expect(seen).toEqual(["Basic abc"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
