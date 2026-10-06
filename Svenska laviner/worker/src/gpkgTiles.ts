// Maps a GeoPackage tile pyramid onto the standard Web Mercator z/x/y grid.
// GeoPackage numbers tiles from its tile matrix set's own top-left corner
// and its zoom_level is just an index, so both are derived from the
// matrix set bounds and each level's pixel size.

export const HALF_WORLD = 20037508.342789244;

export interface TileMatrixSet {
  /** EPSG code of the matrix set's spatial reference system. */
  srs: number;
  minX: number;
  maxY: number;
}

export interface TileMatrix {
  zoomLevel: number;
  tileWidth: number;
  tileHeight: number;
  pixelXSize: number;
  pixelYSize: number;
}

export interface LevelMapping {
  /** GeoPackage zoom_level. */
  gpkgLevel: number;
  /** Web Mercator zoom. */
  z: number;
  /** Add to tile_column / tile_row to get global x / y. */
  offsetX: number;
  offsetY: number;
}

const near = (value: number, tolerance = 1e-3) => Math.abs(value - Math.round(value)) < tolerance;

export function mapLevel(set: TileMatrixSet, matrix: TileMatrix): LevelMapping {
  if (set.srs !== 3857) {
    throw new Error(`Tilesetet är i EPSG:${set.srs}. Beställ i Web Mercator (EPSG:3857).`);
  }
  const spanX = matrix.tileWidth * matrix.pixelXSize;
  const spanY = matrix.tileHeight * matrix.pixelYSize;
  const zExact = Math.log2((2 * HALF_WORLD) / spanX);
  const offsetXExact = (set.minX + HALF_WORLD) / spanX;
  const offsetYExact = (HALF_WORLD - set.maxY) / spanY;
  if (!near(zExact, 1e-6) || !near(offsetXExact) || !near(offsetYExact) || Math.abs(spanX - spanY) > 1e-6 * spanX) {
    throw new Error(`Nivå ${matrix.zoomLevel} följer inte Web Mercator-rutnätet.`);
  }
  return {
    gpkgLevel: matrix.zoomLevel,
    z: Math.round(zExact),
    offsetX: Math.round(offsetXExact),
    offsetY: Math.round(offsetYExact),
  };
}

/** [west, south, east, north] in degrees. */
export type LonLatBox = [number, number, number, number];

/**
 * The mountain areas we keep the map for (the three boxes in KARTBYTE.md,
 * SWEREF 99 TM converted to WGS84 with a small margin). Lantmäteriet ships
 * all of Sweden in one file, far more than R2's free tier holds.
 */
export const MOUNTAIN_BOXES: Record<string, LonLatBox> = {
  norra: [16.85, 67.43, 20.51, 68.72],
  mitten: [13.77, 64.7, 16.43, 66.35],
  sodra: [11.65, 62.11, 14.2, 63.94],
};

/** Up to this zoom the whole file is kept, so zoomed-out views show all of Sweden (a few hundred tiles). */
export const OVERVIEW_MAX_ZOOM = 7;

export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** The Web Mercator tiles at zoom z that touch a box. */
export function tileRange([west, south, east, north]: LonLatBox, z: number): TileRange {
  const n = 2 ** z;
  const x = (lon: number) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)));
  };
  return { minX: x(west), maxX: x(east), minY: y(north), maxY: y(south) };
}

/** The same range in a GeoPackage level's own tile_column / tile_row numbering. */
export function gpkgRange(level: LevelMapping, box: LonLatBox): TileRange {
  const r = tileRange(box, level.z);
  return { minX: r.minX - level.offsetX, maxX: r.maxX - level.offsetX, minY: r.minY - level.offsetY, maxY: r.maxY - level.offsetY };
}
