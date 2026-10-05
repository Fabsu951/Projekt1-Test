import { Preferences } from "@capacitor/preferences";
import { corridorTiles, downloadTiles, estimateBytes, offlineSupported, type DownloadProgress } from "./offlineMap";
import type { LatLon, RouteAnalysis, RouteSample } from "../utils/routePlan";

// Planned routes kept on the device for use without coverage: the points,
// the finished analysis (heights, slopes, profile — which otherwise need
// elevation data from the internet) and the map tiles in a corridor along
// the route, down to the most detailed zoom level.

const META_KEY = "fjallkoll:offline-routes";
/** Map kept on each side of the route. */
const CORRIDOR_KM = 1.5;
const MIN_ZOOM = 8;
const MAX_ZOOM = 15;

export interface OfflineRoute {
  /** "route-<id>" for routes saved in the account, "local-<time>" for drafts. */
  key: string;
  routeId: number | null;
  title: string;
  waypoints: LatLon[];
  analysis: RouteAnalysis;
  tiles: number;
  bytes: number;
  savedAt: string;
}

const cacheName = (key: string) => `fjallkoll-tiles-${key}`;

export function routeTiles(waypoints: LatLon[]) {
  return corridorTiles(waypoints, CORRIDOR_KM, MIN_ZOOM, MAX_ZOOM);
}

export function estimateRouteBytes(waypoints: LatLon[]): number {
  return estimateBytes(routeTiles(waypoints).length);
}

async function readAll(): Promise<Record<string, OfflineRoute>> {
  try {
    const { value } = await Preferences.get({ key: META_KEY });
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, OfflineRoute>): Promise<void> {
  await Preferences.set({ key: META_KEY, value: JSON.stringify(all) });
}

/** Newest first. */
export async function listOfflineRoutes(): Promise<OfflineRoute[]> {
  return Object.values(await readAll()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function offlineRouteFor(routeId: number): Promise<OfflineRoute | null> {
  return (await readAll())[`route-${routeId}`] ?? null;
}

/** The saved analysis for exactly these points, so the profile works without coverage. */
export async function offlineAnalysisFor(points: LatLon[]): Promise<RouteAnalysis | null> {
  const wanted = JSON.stringify(points);
  for (const r of Object.values(await readAll())) {
    if (JSON.stringify(r.waypoints) === wanted) return r.analysis;
  }
  return null;
}

/** Smaller numbers for storage: ~1 m positions, whole metres, whole degrees. */
function compact(analysis: RouteAnalysis): RouteAnalysis {
  const round = (n: number | null, d: number) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
  return {
    ...analysis,
    samples: analysis.samples.map(
      (s): RouteSample => ({
        lat: round(s.lat, 5)!,
        lon: round(s.lon, 5)!,
        distM: Math.round(s.distM),
        elevation: round(s.elevation, 0),
        slope: round(s.slope, 1),
        aspect: round(s.aspect, 0),
      })
    ),
  };
}

export async function saveRouteOffline(
  route: { routeId: number | null; key?: string; title: string; waypoints: LatLon[] },
  analysis: RouteAnalysis,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<OfflineRoute> {
  if (!offlineSupported()) throw new Error("Den här webbläsaren kan inte spara kartor offline.");
  const key = route.key ?? (route.routeId !== null ? `route-${route.routeId}` : `local-${Date.now()}`);
  // A changed route may cover other tiles: start its cache afresh.
  await caches.delete(cacheName(key));
  const result = await downloadTiles(cacheName(key), routeTiles(route.waypoints), tileUrl, onProgress, signal);
  const saved: OfflineRoute = {
    key,
    routeId: route.routeId,
    title: route.title,
    waypoints: route.waypoints,
    analysis: compact(analysis),
    tiles: result.tiles,
    bytes: result.bytes,
    savedAt: new Date().toISOString(),
  };
  const all = await readAll();
  all[key] = saved;
  await writeAll(all);
  return saved;
}

export async function removeOfflineRoute(key: string): Promise<void> {
  if (offlineSupported()) await caches.delete(cacheName(key));
  const all = await readAll();
  delete all[key];
  await writeAll(all);
}
