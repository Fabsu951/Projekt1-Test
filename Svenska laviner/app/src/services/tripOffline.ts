import { getRegionById } from "../data/regions";
import type { PlannedRoute } from "../types/route";
import type { RouteAnalysis } from "../utils/routePlan";
import { offlineMapsAvailable, mapTileUrls } from "./mapTiles";
import { downloadArea, offlineSupported, savedArea, type DownloadProgress } from "./offlineMap";
import { offlineRouteFor, saveRouteOffline } from "./offlineRoutes";

// Before a planned tour day: the area's map (the smaller "Översikt" level)
// and the chosen route's corridor are saved on the device, so they are there
// without coverage. Anything already saved is kept, not downloaded again.

const AUTO_KEY = "fjallkoll:trip-offline";

export function tripOfflineAvailable(): boolean {
  return offlineMapsAvailable && offlineSupported();
}

/** On unless turned off (it can use tens of MB of mobile data). */
export function tripOfflineAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setTripOfflineAuto(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    // Only for this visit.
  }
}

export interface TripOfflineResult {
  /** The area's map was already saved, or has now been. */
  area: boolean;
  /** The route's map and numbers are saved (false without a route). */
  route: boolean;
}

export async function prepareTripOffline(
  regionId: string,
  route: { route: PlannedRoute; analysis: RouteAnalysis } | null,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<TripOfflineResult> {
  const region = getRegionById(regionId);
  if (!region || !tripOfflineAvailable()) return { area: false, route: false };
  if (!(await savedArea(region.id))) await downloadArea(region, "oversikt", mapTileUrls, onProgress, signal);
  if (!route) return { area: true, route: false };
  const saved = await offlineRouteFor(route.route.id);
  if (!saved || saved.savedAt < route.route.updatedAt) {
    await saveRouteOffline(
      { routeId: route.route.id, title: route.route.title, waypoints: route.route.waypoints },
      route.analysis,
      mapTileUrls,
      onProgress,
      signal
    );
  }
  return { area: true, route: true };
}
