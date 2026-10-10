import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Health, type Workout } from "capacitor-health";
import { distanceM, simplify, type TrackPoint } from "../utils/trackImport";
import { createTour, fetchImportedSources, SimilarTourError } from "./tourService";
import type { Tour } from "../types/tour";
import { t, locale } from "../i18n";

// Tours from the phone's health store: Health Connect on Android, Apple
// Hälsa (HealthKit) on iPhone. Exercise sessions with a GPS route, written
// there by the watch's own app. We only read when the user opens the import
// or has turned it on, never anything but sessions and routes, and imported
// tours start out private so nobody's home or car shows up by accident.

const IMPORTED_KEY = "fjallkoll:health-imported";
const CONNECTED_KEY = "fjallkoll:health-connected";
const AUTO_KEY = "fjallkoll:health-auto";
/** Prefix of the source ref stored with each imported tour: "hc:<id>" (Health Connect) or "ah:<uuid>" (Apple Hälsa). */
const SOURCE_PREFIX = Capacitor.getPlatform() === "ios" ? "ah" : "hc";

/** What the phone's health store is called, for the texts. */
export const HEALTH_STORE_NAME = Capacitor.getPlatform() === "ios" ? t("Apple Hälsa") : "Health Connect";
const MAX_REMEMBERED = 500;
/** Health Connect only lets apps read about a month back without a separate history permission. */
export const LOOKBACK_DAYS = 30;
const MIN_POINTS = 10;
const MIN_DISTANCE_M = 300;

/**
 * Exercise types in Swedish; anything else is "Pass". Keys are normalised
 * (lower case, no "_"), since Health Connect says "SKIING" and HealthKit
 * "downhillSkiing".
 */
const TYPE_LABELS: Record<string, string> = {
  skiing: t("Skidtur"),
  downhillskiing: t("Skidtur"),
  crosscountryskiing: t("Längdskidor"),
  snowsports: t("Skidtur"),
  snowboarding: "Snowboard",
  snowshoeing: t("Snöskor"),
  hiking: t("Vandring"),
  walking: t("Promenad"),
  running: t("Löpning"),
  biking: t("Cykeltur"),
  cycling: t("Cykeltur"),
  mountainbiking: "Mountainbike",
  climbing: t("Klättring"),
};

/** Types that are probably ski tours, preselected in the list. */
const WINTER_TYPES = new Set(["skiing", "downhillskiing", "crosscountryskiing", "snowsports", "snowboarding", "snowshoeing", "hiking", "other"]);

const typeKey = (type: string) => type.toLowerCase().replace(/[_\s-]/g, "");

export interface HealthWorkout {
  id: string;
  type: string;
  label: string;
  startDate: string;
  endDate: string;
  distanceM: number;
  points: TrackPoint[];
  /** Probably skiing or touring, so ticked by default. */
  suggested: boolean;
}

/** A session that came without a GPS route; on Android it can often be asked for one at a time. */
export interface RoutelessWorkout {
  id: string;
  type: string;
  label: string;
  startDate: string;
  endDate: string;
  distanceM: number | null;
  suggested: boolean;
  /** Health Connect gave the session an id, so its route can be asked for. */
  canAsk: boolean;
}

interface RoutePoint {
  timestamp: string;
  lat: number;
  lng: number;
  alt?: unknown;
}

/** Our own small Android plugin (android/app/.../HealthRoutesPlugin.java). */
interface HealthRoutesPlugin {
  requestRoute(options: { id: string }): Promise<{ granted: boolean; route: RoutePoint[] }>;
}
const HealthRoutes = registerPlugin<HealthRoutesPlugin>("HealthRoutes");

/** Only in the Android app (Health Connect) and the iPhone app (Apple Hälsa). */
export function healthImportSupported(): boolean {
  return Capacitor.isNativePlatform() && ["android", "ios"].includes(Capacitor.getPlatform());
}

export async function healthConnectAvailable(): Promise<boolean> {
  if (!healthImportSupported()) return false;
  try {
    return (await Health.isHealthAvailable()).available;
  } catch {
    return false;
  }
}

export async function openHealthConnectInstall(): Promise<void> {
  await Health.showHealthConnectInPlayStore();
}

export async function openHealthConnectSettings(): Promise<void> {
  if (Capacitor.getPlatform() === "ios") await Health.openAppleHealthSettings();
  else await Health.openHealthConnectSettings();
}

/**
 * Whether the plugin reports a permission as granted. Its types promise a
 * list of {name: bool}, but both the Android and iOS code answer with one
 * object ({READ_WORKOUTS: true, …}), so accept either.
 */
export function permissionGranted(response: { permissions?: unknown } | null | undefined, name: string): boolean {
  const perms = response?.permissions;
  const list = Array.isArray(perms) ? perms : perms && typeof perms === "object" ? [perms] : [];
  return list.some((p) => !!p && typeof p === "object" && (p as Record<string, unknown>)[name] === true);
}

/**
 * Asks for sessions + routes. Connected once sessions may be read: Health
 * Connect on Android 14 never reports the route permission as granted (other
 * apps' routes are released per session there), so whether routes really
 * come through shows in the scan (`withoutRoute`), not here.
 */
export async function requestHealthAccess(): Promise<{ workouts: boolean; routes: boolean }> {
  const res = await Health.requestHealthPermissions({ permissions: ["READ_WORKOUTS", "READ_ROUTE"] });
  const result = { workouts: permissionGranted(res, "READ_WORKOUTS"), routes: permissionGranted(res, "READ_ROUTE") };
  await Preferences.set({ key: CONNECTED_KEY, value: result.workouts ? "1" : "0" });
  return result;
}

/** Whether the user connected Health Connect before, so we may look for new sessions on our own. */
export async function healthConnected(): Promise<boolean> {
  if (!healthImportSupported()) return false;
  return (await Preferences.get({ key: CONNECTED_KEY })).value === "1";
}

export async function disconnectHealth(): Promise<void> {
  await Preferences.set({ key: CONNECTED_KEY, value: "0" });
}

async function importedIds(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: IMPORTED_KEY });
    const list = value ? JSON.parse(value) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers sessions already imported (or skipped), so they aren't offered again. */
export async function rememberImported(ids: string[]): Promise<void> {
  const all = [...new Set([...ids, ...(await importedIds())])].slice(0, MAX_REMEMBERED);
  await Preferences.set({ key: IMPORTED_KEY, value: JSON.stringify(all) });
}

/**
 * Height in metres. Our plugin sends a number; capacitor-health sends Health
 * Connect's Length object as text, e.g. "812.4 meters".
 */
export function altitudeOf(alt: unknown): number | null {
  if (typeof alt === "number") return Number.isFinite(alt) ? alt : null;
  if (typeof alt !== "string") return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:m|meters?)\s*$/i.exec(alt);
  return m ? Number(m[1]) : null;
}

/** Turns a Health Connect session into our track format, or null if it has no usable route. */
export function toHealthWorkout(w: Workout): HealthWorkout | null {
  const route = (w.route ?? []) as RoutePoint[];
  const raw: TrackPoint[] = route
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => [p.lat, p.lng, altitudeOf(p.alt), Date.parse(p.timestamp) || null]);
  if (raw.length < MIN_POINTS) return null;
  let length = 0;
  for (let i = 1; i < raw.length; i++) length += distanceM(raw[i - 1], raw[i]);
  if (length < MIN_DISTANCE_M) return null;
  const type = w.workoutType || "other";
  return {
    id: w.id ?? `${w.startDate}-${w.endDate}`,
    type,
    label: TYPE_LABELS[typeKey(type)] ?? t("Pass"),
    startDate: w.startDate,
    endDate: w.endDate,
    distanceM: Math.round(w.distance ?? length),
    points: simplify(raw),
    suggested: WINTER_TYPES.has(typeKey(type)),
  };
}

export const sourceRefFor = (w: Pick<HealthWorkout, "id">) => `${SOURCE_PREFIX}:${w.id}`.slice(0, 200);

/**
 * Sessions with a route from the last month that haven't been imported yet,
 * newest first. With a token, tours imported from another phone count too.
 */
export async function findNewWorkouts(token?: string | null, now = new Date()): Promise<HealthWorkout[]> {
  return (await scanWorkouts(token, now)).workouts;
}

/** Like findNewWorkouts, plus how many new sessions came without a usable GPS route. */
export async function scanWorkouts(
  token?: string | null,
  now = new Date()
): Promise<{ workouts: HealthWorkout[]; withoutRoute: RoutelessWorkout[] }> {
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const { workouts } = await Health.queryWorkouts({
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    includeRoute: true,
    includeHeartRate: false,
    includeSteps: false,
  });
  const done = new Set(await importedIds());
  const onServer = new Set(token ? await fetchImportedSources(token, SOURCE_PREFIX).catch(() => []) : []);
  const fresh = workouts.filter((w) => {
    const id = w.id ?? `${w.startDate}-${w.endDate}`;
    return !done.has(id) && !onServer.has(sourceRefFor({ id }));
  });
  const newestFirst = <T extends { startDate: string }>(a: T, b: T) => (a.startDate < b.startDate ? 1 : -1);
  const usable: HealthWorkout[] = [];
  const routeless: RoutelessWorkout[] = [];
  for (const w of fresh) {
    const ready = toHealthWorkout(w);
    if (ready) usable.push(ready);
    else routeless.push(routelessOf(w));
  }
  return { workouts: usable.sort(newestFirst), withoutRoute: routeless.sort(newestFirst) };
}

function routelessOf(w: Workout): RoutelessWorkout {
  const type = w.workoutType || "other";
  return {
    id: w.id ?? `${w.startDate}-${w.endDate}`,
    type,
    label: TYPE_LABELS[typeKey(type)] ?? t("Pass"),
    startDate: w.startDate,
    endDate: w.endDate,
    distanceM: typeof w.distance === "number" && w.distance > 0 ? Math.round(w.distance) : null,
    suggested: WINTER_TYPES.has(typeKey(type)),
    canAsk: !!w.id,
  };
}

/** Whether this phone can ask Health Connect for a single workout's route (our Android plugin). */
export function routeRequestAvailable(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("HealthRoutes");
}

/**
 * Opens Health Connect's dialog asking to share one workout's GPS route.
 * Returns the workout ready to import, or null if the user said no or the
 * workout has no usable route.
 */
export async function requestWorkoutRoute(w: RoutelessWorkout): Promise<HealthWorkout | null> {
  if (!w.canAsk) return null;
  const answer = await HealthRoutes.requestRoute({ id: w.id });
  if (!answer.granted) return null;
  return toHealthWorkout({
    id: w.id,
    workoutType: w.type,
    startDate: w.startDate,
    endDate: w.endDate,
    distance: w.distanceM ?? undefined,
    route: answer.route as Workout["route"],
    sourceName: "",
    sourceBundleId: "",
    duration: 0,
    calories: 0,
  });
}

/** "Skidtur 3 februari" – a starting title the user can change later. */
export function defaultTitle(w: HealthWorkout): string {
  const day = new Date(w.startDate).toLocaleDateString(locale(), { day: "numeric", month: "long" });
  return `${w.label} ${day}`;
}

/** Uploads one session as a private tour (the server ignores a session it already has). */
export async function importWorkout(token: string, w: HealthWorkout): Promise<Tour> {
  let tour: Tour;
  try {
    tour = await createTour(token, {
      title: defaultTitle(w),
      description: "",
      visibility: "private",
      hideEndsM: 500,
      date: null,
      points: w.points,
      sourceRef: sourceRefFor(w),
    });
  } catch (err) {
    // Already uploaded another way (a GPX file of the same outing): not offered again.
    if (err instanceof SimilarTourError) await rememberImported([w.id]);
    throw err;
  }
  await rememberImported([w.id]);
  return tour;
}

/** Whether new ski sessions are added on their own (still as private tours). */
export async function autoImportEnabled(): Promise<boolean> {
  return (await Preferences.get({ key: AUTO_KEY })).value === "1";
}

export async function setAutoImport(on: boolean): Promise<void> {
  await Preferences.set({ key: AUTO_KEY, value: on ? "1" : "0" });
}

export interface AutoImportResult {
  imported: Tour[];
  /** New sessions that weren't imported on their own (runs, walks …) and wait for the user. */
  waiting: number;
}

let running: Promise<AutoImportResult> | null = null;

/**
 * Looks for new sessions and, if automatic import is on, adds the likely ski
 * tours as private tours. Screens asking at the same time share one run.
 */
export function checkForNewWorkouts(token: string): Promise<AutoImportResult> {
  running ??= (async () => {
    const found = await findNewWorkouts(token);
    if (!(await autoImportEnabled())) return { imported: [], waiting: found.length };
    const imported: Tour[] = [];
    let waiting = 0;
    for (const w of found) {
      if (!w.suggested) {
        waiting++;
        continue;
      }
      try {
        imported.push(await importWorkout(token, w));
      } catch (err) {
        // Offline or over the upload limit: try again next time. A tour you
        // already have is simply skipped.
        if (!(err instanceof SimilarTourError)) waiting++;
      }
    }
    return { imported, waiting };
  })().finally(() => {
    running = null;
  });
  return running;
}
