import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fromArrayBuffer, fromFile } from "geotiff";
import proj4 from "proj4";

// Lantmäteriet's height model ("Markhöjdmodell Nedladdning, grid 1+"):
// GeoTIFF squares in SWEREF 99 TM (EPSG:3006), heights in metres. Read from
// a folder of downloaded files, or fetched one square at a time straight from
// Lantmäteriet (a STAC item list from fetch-hojd.ps1, login in env LM_AUTH);
// every pixel is needed, so each file is fetched whole, kept in memory only
// while it is in use, and never saved to disk.

proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
const toSweref = proj4("EPSG:4326", "EPSG:3006");

export function project(lon: number, lat: number): [number, number] {
  return toSweref.forward([lon, lat]) as [number, number];
}

export function unproject(east: number, north: number): [number, number] {
  return toSweref.inverse([east, north]) as [number, number];
}

type Box = [number, number, number, number];

export interface DemFile {
  name: string;
  /** SWEREF 99 TM [minE, minN, maxE, maxN]; may be a little too big until opened. */
  bbox: Box;
  /** WGS84 [west, south, east, north]. */
  lonLat: Box;
  open(): Promise<Raster>;
}

export interface Raster {
  bbox: Box;
  /** West edge, north edge, metres per cell. */
  originE: number;
  originN: number;
  res: number;
  width: number;
  height: number;
  data: ArrayLike<number>;
  nodata: number | null;
}

async function readRaster(tiff: Awaited<ReturnType<typeof fromArrayBuffer>>, name: string): Promise<Raster> {
  const image = await tiff.getImage();
  const [originE, originN] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  if (Math.abs(Math.abs(resX) - Math.abs(resY)) > 1e-6) throw new Error(`${name}: rutorna är inte kvadratiska`);
  const width = image.getWidth();
  const height = image.getHeight();
  const res = Math.abs(resX);
  const [band] = (await image.readRasters({ samples: [0] })) as unknown as [ArrayLike<number>];
  const nodata = image.getGDALNoData();
  return {
    bbox: [originE, originN - height * res, originE + width * res, originN],
    originE,
    originN,
    res,
    width,
    height,
    data: band,
    nodata: nodata ?? null,
  };
}

function lonLatOf(bbox: Box): Box {
  const corners = [unproject(bbox[0], bbox[1]), unproject(bbox[2], bbox[1]), unproject(bbox[0], bbox[3]), unproject(bbox[2], bbox[3])];
  return [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
}

function swerefOf(lonLat: Box): Box {
  const corners = [project(lonLat[0], lonLat[1]), project(lonLat[2], lonLat[1]), project(lonLat[0], lonLat[3]), project(lonLat[2], lonLat[3])];
  return [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
}

/** Every .tif in a folder (headers are read once to know where each lies). */
export async function filesInFolder(folder: string): Promise<DemFile[]> {
  const names = readdirSync(folder).filter((f) => /\.tiff?$/i.test(f));
  const files: DemFile[] = [];
  for (const name of names) {
    const path = join(folder, name);
    const tiff = await fromFile(path);
    const image = await tiff.getImage();
    const [w, s, e, n] = image.getBoundingBox();
    const bbox: Box = [w, s, e, n];
    files.push({ name, bbox, lonLat: lonLatOf(bbox), open: async () => readRaster(await fromFile(path), name) });
  }
  return files;
}

interface StacItem {
  id: string;
  bbox?: number[];
  properties?: Record<string, unknown>;
  assets?: Record<string, { href: string; type?: string }>;
}

/** GeoTIFF assets of STAC items (fetch-hojd.ps1 saves them), read remotely with the login in LM_AUTH. */
export function filesFromStac(items: StacItem[], auth: string | undefined): DemFile[] {
  const files: DemFile[] = [];
  for (const item of items) {
    const asset = Object.values(item.assets ?? {}).find((a) => /tiff|geotiff/i.test(a.type ?? "") || /\.tiff?($|\?)/i.test(a.href));
    if (!asset || !item.bbox || item.bbox.length < 4) continue;
    const lonLat: Box = [item.bbox[0], item.bbox[1], item.bbox[2], item.bbox[3]];
    const projBbox = item.properties?.["proj:bbox"];
    const bbox: Box = Array.isArray(projBbox) && projBbox.length >= 4 ? (projBbox.slice(0, 4) as Box) : swerefOf(lonLat);
    const headers = auth ? { Authorization: auth } : undefined;
    files.push({
      name: item.id,
      bbox,
      lonLat,
      open: async () => {
        for (let attempt = 1; ; attempt++) {
          try {
            const res = await fetch(asset.href, { headers, signal: AbortSignal.timeout(300_000) });
            if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`Inloggningen godtogs inte (${res.status}).`), { fatal: true });
            if (!res.ok) throw new Error(`${item.id}: HTTP ${res.status}`);
            return await readRaster(await fromArrayBuffer(await res.arrayBuffer()), item.id);
          } catch (err) {
            if ((err as { fatal?: boolean }).fatal || attempt >= 5) throw err;
            await new Promise((r) => setTimeout(r, 3000 * attempt));
          }
        }
      },
    });
  }
  return files;
}

const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * Heights at SWEREF 99 TM points, bilinear between cells, from whichever file
 * covers the point. `prepare(area)` loads the files for an area first (the
 * sampler itself is synchronous); at most `keep` files stay in memory.
 */
export class HeightModel {
  private loaded = new Map<string, Raster>();

  constructor(
    private files: DemFile[],
    private keep = 24
  ) {}

  /** Files that may cover a SWEREF 99 TM box. */
  covering(area: Box): DemFile[] {
    return this.files.filter((f) => overlaps(f.bbox, area));
  }

  async prepare(area: Box): Promise<number> {
    const needed = this.covering(area);
    for (const f of needed) {
      const had = this.loaded.get(f.name);
      if (had) {
        // Most recently used goes last.
        this.loaded.delete(f.name);
        this.loaded.set(f.name, had);
        continue;
      }
      this.loaded.set(f.name, await f.open());
      while (this.loaded.size > this.keep) this.loaded.delete(this.loaded.keys().next().value!);
    }
    return needed.length;
  }

  private value(r: Raster, col: number, row: number): number | null {
    if (col < 0 || row < 0 || col >= r.width || row >= r.height) return null;
    const v = r.data[row * r.width + col];
    if (!Number.isFinite(v) || (r.nodata !== null && v === r.nodata) || v < -1000) return null;
    return v;
  }

  height = (east: number, north: number): number | null => {
    for (const r of this.loaded.values()) {
      if (east < r.bbox[0] || east >= r.bbox[2] || north <= r.bbox[1] || north > r.bbox[3]) continue;
      // Cell centres are half a cell in from the edges.
      const fx = (east - r.originE) / r.res - 0.5;
      const fy = (r.originN - north) / r.res - 0.5;
      const c = Math.floor(fx);
      const w = Math.floor(fy);
      const tx = fx - c;
      const ty = fy - w;
      const a = this.value(r, c, w) ?? this.value(r, c + 1, w) ?? this.value(r, c, w + 1);
      const b = this.value(r, c + 1, w) ?? a;
      const d = this.value(r, c, w + 1) ?? a;
      const e = this.value(r, c + 1, w + 1) ?? b;
      if (a === null || b === null || d === null || e === null) return null;
      return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    }
    return null;
  };
}
