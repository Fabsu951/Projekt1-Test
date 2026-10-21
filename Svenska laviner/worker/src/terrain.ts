import { corsHeaders } from "./http";
import { fetchable } from "./tiles";
import { imageType } from "./tileBatch";

// Naturvårdsverket's official terrain maps for avalanche terrain (WMS layers
// in the lavinprognoser workspace): slope angle and slope aspect. Petter
// Palmgren (Lavinprognostjänsten) agreed on 2026-10-07 that we show them with
// Naturvårdsverket as the source and with their legends. They warned that
// heavy use can strain their servers at peak times, so the app never asks
// them directly: every tile goes through here and is kept in Cloudflare's
// cache for a month (the maps change very rarely).

const WMS = "https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/wms";
const HEADERS = { "User-Agent": "Snolage/1.0 (https://snolage.se; fabian.n.sund@gmail.com)" };
const TERRAIN_TTL_SECONDS = 60 * 60 * 24 * 30;
const HALF_WORLD = 20037508.342789244;

/** Our path names → their layer names. Nothing else can be asked for. */
export const TERRAIN_LAYERS: Record<string, string> = {
  lutning: "lavinprognoser:slope_inclination",
  riktning: "lavinprognoser:slope_aspect",
};

/** The Web Mercator bounding box of tile z/x/y: [minX, minY, maxX, maxY] in metres. */
export function tileBbox(z: number, x: number, y: number): [number, number, number, number] {
  const size = (2 * HALF_WORLD) / 2 ** z;
  const minX = -HALF_WORLD + x * size;
  const maxY = HALF_WORLD - y * size;
  return [minX, maxY - size, minX + size, maxY];
}

export function terrainTileUrl(layer: string, z: number, x: number, y: number): string {
  const url = new URL(WMS);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.1.1");
  url.searchParams.set("request", "GetMap");
  url.searchParams.set("layers", layer);
  url.searchParams.set("styles", "");
  url.searchParams.set("srs", "EPSG:3857");
  url.searchParams.set("bbox", tileBbox(z, x, y).join(","));
  url.searchParams.set("width", "256");
  url.searchParams.set("height", "256");
  url.searchParams.set("format", "image/png");
  url.searchParams.set("transparent", "true");
  return url.toString();
}

export function terrainLegendUrl(layer: string): string {
  const url = new URL(WMS);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.1.1");
  url.searchParams.set("request", "GetLegendGraphic");
  url.searchParams.set("layer", layer);
  url.searchParams.set("format", "image/png");
  url.searchParams.set("legend_options", "fontAntiAliasing:true;fontSize:12;dpi:110");
  return url.toString();
}

/** "/terrain/lutning/12/2233/939.png" or "/terrain/lutning/legend.png". */
export function parseTerrainPath(pathname: string): { layer: string; tile: { z: number; x: number; y: number } | null } | null {
  const legend = /^\/terrain\/([a-z]+)\/legend\.png$/.exec(pathname);
  if (legend) return TERRAIN_LAYERS[legend[1]] ? { layer: legend[1], tile: null } : null;
  const m = /^\/terrain\/([a-z]+)\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/.exec(pathname);
  if (!m || !TERRAIN_LAYERS[m[1]]) return null;
  const [z, x, y] = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (x >= 2 ** z || y >= 2 ** z) return null;
  return { layer: m[1], tile: { z, x, y } };
}

/** One terrain tile or legend, from Cloudflare's cache or Naturvårdsverket. */
export async function serveTerrain(
  request: Request,
  ctx: ExecutionContext,
  origin: string,
  target: { layer: string; tile: { z: number; x: number; y: number } | null }
): Promise<Response> {
  const { layer, tile } = target;
  // Only tiles over Sweden at zoom ≤ 15 (the app enlarges beyond that), so this can't be used to crawl them.
  if (tile && !fetchable(tile.z, tile.x, tile.y)) return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const cache = caches.default;
  const path = tile ? `/terrain/${layer}/${tile.z}/${tile.x}/${tile.y}.png` : `/terrain/${layer}/legend.png`;
  const cacheKey = new Request(new URL(path, request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const source = tile ? terrainTileUrl(TERRAIN_LAYERS[layer], tile.z, tile.x, tile.y) : terrainLegendUrl(TERRAIN_LAYERS[layer]);
  let data: Uint8Array | null = null;
  try {
    const res = await fetch(source, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
    // GeoServer reports errors as XML with status 200, so check that it's really an image.
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (imageType(bytes)) data = bytes;
    }
  } catch {
    data = null;
  }
  if (!data) return new Response("Terrängkartan kunde inte hämtas just nu.", { status: 502, headers: corsHeaders(origin) });

  const response = new Response(data, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": imageType(data)!,
      "Cache-Control": `public, max-age=${TERRAIN_TTL_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
