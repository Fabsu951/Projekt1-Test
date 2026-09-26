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
