import { describe, expect, it } from "vitest";
import { parseTerrainPath, terrainLegendUrl, terrainTileUrl, tileBbox } from "./terrain";

describe("official terrain layers", () => {
  it("accepts only our two layers and real tile numbers", () => {
    expect(parseTerrainPath("/terrain/lutning/12/2233/939.png")).toEqual({ layer: "lutning", tile: { z: 12, x: 2233, y: 939 } });
    expect(parseTerrainPath("/terrain/riktning/legend.png")).toEqual({ layer: "riktning", tile: null });
    expect(parseTerrainPath("/terrain/annat/12/1/1.png")).toBeNull();
    expect(parseTerrainPath("/terrain/lutning/2/4/0.png")).toBeNull();
    expect(parseTerrainPath("/terrain/lutning/../x.png")).toBeNull();
  });

  it("asks their WMS for exactly the tile's square", () => {
    // Zoom 1, tile 1/0 is the north-east quarter of the world.
    const [minX, minY, maxX, maxY] = tileBbox(1, 1, 0);
    expect(minX).toBeCloseTo(0);
    expect(minY).toBeCloseTo(0);
    expect(maxX).toBeCloseTo(20037508.34, 1);
    expect(maxY).toBeCloseTo(20037508.34, 1);
    const url = new URL(terrainTileUrl("lavinprognoser:slope_inclination", 12, 2233, 939));
    expect(url.origin + url.pathname).toBe("https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/wms");
    expect(url.searchParams.get("layers")).toBe("lavinprognoser:slope_inclination");
    expect(url.searchParams.get("srs")).toBe("EPSG:3857");
    expect(url.searchParams.get("bbox")!.split(",")).toHaveLength(4);
    expect(new URL(terrainLegendUrl("lavinprognoser:slope_aspect")).searchParams.get("request")).toBe("GetLegendGraphic");
  });
});
