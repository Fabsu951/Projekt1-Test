import { NORWAY, SWEDEN } from "../data/borders";

// Lantmäteriet's map is plain white over Norway, where Kartverket's map is
// drawn on top of it anyway. Fetching those white tiles only slows the map
// down (outside our own map bucket each one goes through the worker), so a
// tile that lies wholly in Norway – well clear of the Swedish border – is
// left out. The outlines are simplified (≈ 2.5 km at worst), so a tile is
// only skipped when it stays more than BUFFER_KM from Sweden.

const BUFFER_KM = 5;
/** Up to here our map bucket has every tile, and Lantmäteriet's own backdrop shows the neighbours. */
const ALWAYS_UP_TO_ZOOM = 7;

type Ring = ArrayLike<number>;

function inside(ring: Ring, lon: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

/** Whether a lon/lat box and a ring overlap at all. */
export function boxTouches(ring: Ring, west: number, south: number, east: number, north: number): boolean {
  for (let i = 0; i < ring.length; i += 2) {
    if (ring[i] >= west && ring[i] <= east && ring[i + 1] >= south && ring[i + 1] <= north) return true;
  }
  if (inside(ring, west, south) || inside(ring, east, north)) return true;
  const sides: Array<[number, number, number, number]> = [
    [west, south, east, south],
    [east, south, east, north],
    [east, north, west, north],
    [west, north, west, south],
  ];
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    for (const [ax, ay, bx, by] of sides) {
      if (segmentsCross(ax, ay, bx, by, ring[j], ring[j + 1], ring[i], ring[i + 1])) return true;
    }
  }
  return false;
}

const tileLon = (x: number, n: number) => (x / n) * 360 - 180;
const tileLat = (y: number, n: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

const seen = new Map<string, boolean>();

/** True for a Lantmäteriet tile that lies wholly in Norway, more than BUFFER_KM from Sweden. */
export function tileInNorwayOnly(z: number, x: number, y: number): boolean {
  if (z <= ALWAYS_UP_TO_ZOOM) return false;
  const key = `${z}/${x}/${y}`;
  const known = seen.get(key);
  if (known !== undefined) return known;
  const n = 2 ** z;
  const north = tileLat(y, n), south = tileLat(y + 1, n);
  const dLat = BUFFER_KM / 111.32;
  const dLon = dLat / Math.cos((((north + south) / 2) * Math.PI) / 180);
  const west = tileLon(x, n) - dLon, east = tileLon(x + 1, n) + dLon;
  const result =
    !boxTouches(SWEDEN, west, south - dLat, east, north + dLat) &&
    inside(NORWAY, (west + east) / 2, (north + south) / 2);
  if (seen.size > 20_000) seen.clear();
  seen.set(key, result);
  return result;
}
