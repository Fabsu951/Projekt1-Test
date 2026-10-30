// Height above sea level at any point, read from the same open elevation
// tiles the slope layer draws (Mapterhorn, Terrarium encoding: metres =
// R·256 + G + B/256 − 32768). In Sweden and Norway Mapterhorn is built from
// the national 1 m height models (Lantmäteriet's Markhöjdmodell, Kartverket's
// DTM); zoom 13 reads them at a few metres, and slopes are measured over
// ±30 m so single boulders don't count. Tiles are decoded once and kept in memory.

export const ELEVATION_TILE_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
/** Zoom level the heights are read at; finer than the data itself. */
const ZOOM = 13;
/** Metres either side of a point used to measure the slope under it. */
const SLOPE_SPAN_M = 30;
const METRES_PER_DEG_LAT = 111_320;

export interface ElevationTile {
  size: number;
  heights: Float32Array;
}

const TILE_TIMEOUT_MS = 20_000;

/** Loads one tile's heights; replaced in tests. */
export type TileLoader = (z: number, x: number, y: number) => Promise<ElevationTile | null>;

export const loadTerrariumTile: TileLoader = async (z, x, y) => {
  const url = ELEVATION_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // On a weak signal a tile can hang; without a limit the route analysis would wait for ever.
    await Promise.race([
      img.decode(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), TILE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    img.src = "";
    return null;
  } finally {
    clearTimeout(timer);
  }
  const size = img.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  const heights = new Float32Array(size * size);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768;
  }
  return { size, heights };
};

/** Position of a point in tile units at the sampler's zoom (Web Mercator). */
function tilePosition(lat: number, lon: number): [number, number] {
  const n = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return [x, y];
}

export interface Terrain {
  elevation: number;
  /** Steepness of the ground, degrees. */
  slope: number;
  /** Compass direction the slope faces (downhill), degrees from north; null on flat ground. */
  aspect: number | null;
}

export class ElevationSampler {
  private tiles = new Map<string, Promise<ElevationTile | null>>();

  private load: TileLoader;

  constructor(load: TileLoader = loadTerrariumTile) {
    this.load = load;
  }

  private tile(x: number, y: number): Promise<ElevationTile | null> {
    const key = `${x}/${y}`;
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = this.load(ZOOM, x, y).catch(() => null);
      this.tiles.set(key, tile);
    }
    return tile;
  }

  /** Starts fetching every tile the points (and their slope neighbours) need. */
  private async prepare(points: Array<[number, number]>): Promise<void> {
    const keys = new Set<string>();
    const pad = SLOPE_SPAN_M / METRES_PER_DEG_LAT;
    for (const [lat, lon] of points) {
      for (const [dLat, dLon] of [[0, 0], [pad, pad * 3], [-pad, -pad * 3], [pad, -pad * 3], [-pad, pad * 3]]) {
        const [tx, ty] = tilePosition(lat + dLat, lon + dLon);
        keys.add(`${Math.floor(tx)}/${Math.floor(ty)}`);
      }
    }
    await Promise.all([...keys].map((k) => this.tile(...(k.split("/").map(Number) as [number, number]))));
  }

  private loaded = new Map<string, ElevationTile | null>();

  private async settle(): Promise<void> {
    for (const [key, promise] of this.tiles) {
      if (!this.loaded.has(key)) this.loaded.set(key, await promise);
    }
  }

  /** Height at a point, or null where no tile could be loaded. Call ready() first. */
  heightSync(lat: number, lon: number): number | null {
    const [tx, ty] = tilePosition(lat, lon);
    const home = this.loaded.get(`${Math.floor(tx)}/${Math.floor(ty)}`);
    if (!home) return null;
    const size = home.size;
    // Bilinear interpolation between the four nearest pixel centres, which
    // may lie in the neighbouring tile near an edge (all tiles share a size).
    const gx = tx * size - 0.5;
    const gy = ty * size - 0.5;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const pixel = (x: number, y: number): number => {
      const tile = this.loaded.get(`${Math.floor(x / size)}/${Math.floor(y / size)}`) ?? home;
      const px = Math.min(size - 1, Math.max(0, x - Math.floor(x / size) * size));
      const py = Math.min(size - 1, Math.max(0, y - Math.floor(y / size) * size));
      return tile.heights[py * size + px];
    };
    const top = pixel(x0, y0) * (1 - fx) + pixel(x0 + 1, y0) * fx;
    const bottom = pixel(x0, y0 + 1) * (1 - fx) + pixel(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }

  /** Height, slope and aspect of the ground at a point. Call ready() first. */
  terrainSync(lat: number, lon: number): Terrain | null {
    const elevation = this.heightSync(lat, lon);
    if (elevation === null) return null;
    const dLat = SLOPE_SPAN_M / METRES_PER_DEG_LAT;
    const dLon = dLat / Math.cos((lat * Math.PI) / 180);
    const n = this.heightSync(lat + dLat, lon);
    const s = this.heightSync(lat - dLat, lon);
    const e = this.heightSync(lat, lon + dLon);
    const w = this.heightSync(lat, lon - dLon);
    if (n === null || s === null || e === null || w === null) return { elevation, slope: 0, aspect: null };
    const dzdx = (e - w) / (2 * SLOPE_SPAN_M); // rise towards east
    const dzdy = (n - s) / (2 * SLOPE_SPAN_M); // rise towards north
    const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    if (slope < 2) return { elevation, slope, aspect: null };
    const aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
    return { elevation, slope, aspect };
  }

  /** Loads what the points need and waits for it. */
  async ready(points: Array<[number, number]>): Promise<void> {
    await this.prepare(points);
    await this.settle();
  }
}
