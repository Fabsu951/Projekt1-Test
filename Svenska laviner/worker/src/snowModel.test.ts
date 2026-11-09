import proj4 from "proj4";
import { describe, expect, it } from "vitest";
import { cellFromSeries, fetchSnowModel, readSeries, SNOW_CELLS, toUtm33 } from "./snowModel";

const UTM33 = "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";

describe("toUtm33", () => {
  it("matches proj4 within a metre across the Swedish mountains", () => {
    for (const cells of Object.values(SNOW_CELLS)) {
      for (const [lat, lon] of cells) {
        const [x, y] = proj4("WGS84", UTM33, [lon, lat]);
        const [ux, uy] = toUtm33(lat, lon);
        expect(Math.abs(ux - x)).toBeLessThan(1);
        expect(Math.abs(uy - y)).toBeLessThan(1);
      }
    }
  });

  it("gives the cell NVE answered for at Kebnekaise", () => {
    // Seen in the live check 2026-11-09 (proj4 with the same parameters).
    expect(toUtm33(67.9, 18.55)).toEqual([648979, 7535993]);
  });
});

// The real answer for Kebnekaise, 2–11 Nov 2026 (the last two days are model forecast).
const SD = { Theme: "sd", NoDataValue: 65535, StartDate: "02.11.2026 06:00:00", Unit: "cm", Altitude: 1660, Data: [18.5, 21.8, 21.8, 31.7, 31.6, 31.3, 30.9, 38, 49.1, 48.7] };
const FSW3D = { NoDataValue: 65535, Unit: "cm", Altitude: 1660, Data: [0, 3.6, 3.8, 14.7, 11.7, 12, 1.4, 9.2] };

describe("cellFromSeries", () => {
  it("takes today's value, not the forecast days after it, and the change over the week", () => {
    expect(cellFromSeries(67.9, 18.55, "2026-11-02", SD, FSW3D)).toEqual({
      lat: 67.9,
      lon: 18.55,
      altitude: 1660,
      date: "2026-11-09",
      depthCm: 38,
      weekChangeCm: 20,
      newSnow3dCm: 9,
    });
  });

  it("falls back to the latest day with a value, and treats nodata as missing", () => {
    const cell = cellFromSeries(67.9, 18.55, "2026-11-02", { ...SD, Data: [10, 11, 12, 13, 14, 15, 16, 65535] }, null);
    expect(cell).toMatchObject({ date: "2026-11-08", depthCm: 16, weekChangeCm: null, newSnow3dCm: null });
    expect(readSeries({ NoDataValue: 255, Data: [255, -3, "x", 4] })).toEqual([null, null, null, 4]);
    expect(cellFromSeries(1, 1, "2026-11-02", { NoDataValue: 65535, Data: [65535, 65535] }, null)).toBeNull();
  });
});

describe("fetchSnowModel", () => {
  it("asks for three cells per area and sorts them highest first, leaving out cells outside the grid", async () => {
    const asked: string[] = [];
    const heights = [900, 1660, 600];
    let n = 0;
    const fetcher = (async (url: string) => {
      asked.push(url);
      if (url.endsWith("/sdfsw3d.json")) return new Response(JSON.stringify(FSW3D));
      const i = n++;
      if (i === 2) return new Response("outside", { status: 400 });
      return new Response(JSON.stringify({ ...SD, Altitude: heights[i] }));
    }) as typeof fetch;
    const model = await fetchSnowModel("kebnekaisefjallen", new Date("2026-11-09T10:00:00Z"), fetcher);
    expect(asked).toHaveLength(6);
    expect(asked[0]).toBe("https://gts.nve.no/api/GridTimeSeries/648979/7535993/2026-11-02/2026-11-09/sd.json");
    expect(model!.cells.map((c) => c.altitude)).toEqual([1660, 900]);
    expect(await fetchSnowModel("nowhere", new Date(), fetcher)).toBeNull();
  });
});
