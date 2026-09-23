const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The forecast region whose center is closest to a point. */
export function nearestRegionId(
  point: { lat: number; lon: number },
  regions: Array<{ id: string; lat: number; lon: number }>
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const r of regions) {
    const d = haversineDistanceKm(point, r);
    if (d < bestDistance) {
      bestDistance = d;
      best = r.id;
    }
  }
  return best;
}
