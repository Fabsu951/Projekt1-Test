import { Preferences } from "@capacitor/preferences";
import { api, ApiError } from "./api";
import { cached, USER_SCOPE } from "./cache";

// "Dela position" (worker/src/locationShare.ts): for a few hours, people you
// pick (today's tour company or people you follow) see where you last were.
// The app sends the position while it is open; the worker keeps only the
// latest point and deletes it when the share ends. Needs coverage, so it is
// never a substitute for a transceiver – the app says so where it is offered.

export interface SharePerson {
  id: number;
  displayName: string;
  avatarPath: string | null;
  xp: number;
  isAdmin?: boolean;
}

export interface ShareCandidate extends SharePerson {
  /** On a tour day with you today. */
  companion: boolean;
}

export interface SharedPosition {
  lat: number;
  lon: number;
  /** Metres, as the phone reported it. */
  accuracy: number | null;
  at: string;
}

export interface MyShare {
  startedAt: string;
  endsAt: string;
  position: SharedPosition | null;
  viewers: SharePerson[];
}

export interface FriendShare extends SharePerson {
  startedAt: string;
  endsAt: string;
  position: SharedPosition | null;
  /** Ran out without being stopped: the last point stays until keptUntil. */
  ended?: boolean;
  keptUntil?: string | null;
}

/** Your own share that ran out without being stopped, whose last point others still see. */
export interface LingeringShare {
  endsAt: string;
  keptUntil: string;
  position: SharedPosition | null;
}

/** How long the last point stays after a share runs out without being stopped (worker LINGER_HOURS). */
export const LINGER_HOURS = 24;

/** The choices offered for how long a share lasts. */
export const SHARE_HOURS = [2, 4, 8, 12] as const;
export const DEFAULT_SHARE_HOURS = 8;

/** Fired when a share starts, changes or ends on this device. */
export const SHARE_CHANGED_EVENT = "fjallkoll:location-share-changed";
/** Fired when a position has been sent; detail = SharedPosition. */
export const SHARE_SENT_EVENT = "fjallkoll:location-share-sent";

const ACTIVE_KEY = "fjallkoll:location-share";
const LINGER_KEY = "fjallkoll:location-share-left";

/** What this device remembers about its running share, so it keeps sending across pages and restarts. */
export interface ActiveShare {
  userId: number;
  endsAt: string;
}

export async function activeShare(userId: number | undefined, now = Date.now()): Promise<ActiveShare | null> {
  if (!userId) return null;
  try {
    const { value } = await Preferences.get({ key: ACTIVE_KEY });
    const saved = value ? (JSON.parse(value) as ActiveShare) : null;
    if (!saved || saved.userId !== userId) return null;
    return Date.parse(saved.endsAt) > now ? saved : null;
  } catch {
    return null;
  }
}

async function remember(active: ActiveShare | null): Promise<void> {
  try {
    if (active) await Preferences.set({ key: ACTIVE_KEY, value: JSON.stringify(active) });
    else await Preferences.remove({ key: ACTIVE_KEY });
  } catch {
    // Without storage the share still runs while this page is open.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SHARE_CHANGED_EVENT));
}

export async function forgetActiveShare(): Promise<void> {
  await remember(null);
}

/** A share that ran out on this device without being stopped: others still see the last point until keptUntil. */
export async function lingeringShare(userId: number | undefined, now = Date.now()): Promise<{ userId: number; keptUntil: string } | null> {
  if (!userId) return null;
  try {
    const { value } = await Preferences.get({ key: LINGER_KEY });
    let saved = value ? (JSON.parse(value) as { userId: number; keptUntil: string }) : null;
    if (!saved) {
      // The app was closed when the end time passed: the running share is still remembered.
      const running = (await Preferences.get({ key: ACTIVE_KEY })).value;
      const active = running ? (JSON.parse(running) as ActiveShare) : null;
      if (active && Date.parse(active.endsAt) <= now) {
        saved = { userId: active.userId, keptUntil: new Date(Date.parse(active.endsAt) + LINGER_HOURS * 3600_000).toISOString() };
      }
    }
    return saved && saved.userId === userId && Date.parse(saved.keptUntil) > now ? saved : null;
  } catch {
    return null;
  }
}

/** Called when the end time passes without a stop: the banner then says the last point is still shown. */
export async function shareRanOut(active: ActiveShare): Promise<void> {
  try {
    const keptUntil = new Date(Date.parse(active.endsAt) + LINGER_HOURS * 3600_000).toISOString();
    await Preferences.set({ key: LINGER_KEY, value: JSON.stringify({ userId: active.userId, keptUntil }) });
  } catch {
    // Only the banner needs it.
  }
  await remember(null);
}

export async function fetchMyShare(
  token: string
): Promise<{ share: MyShare | null; lingering: LingeringShare | null; candidates: ShareCandidate[] }> {
  const r = await api<{ share: MyShare | null; lingering?: LingeringShare | null; candidates: ShareCandidate[] }>("/location/share", { token });
  return { ...r, lingering: r.lingering ?? null };
}

export async function startSharing(token: string, userId: number, viewerIds: number[], hours: number): Promise<MyShare> {
  const { share } = await api<{ share: MyShare }>("/location/share", { method: "POST", token, json: { viewerIds, hours } });
  await remember({ userId, endsAt: share.endsAt });
  return share;
}

/** Stops sharing; the position is deleted on the server. Also used on logout. */
export async function stopSharing(token: string | null): Promise<void> {
  try {
    await Preferences.remove({ key: LINGER_KEY });
  } catch {
    // Nothing saved.
  }
  await remember(null);
  if (!token) return;
  try {
    await api("/location/share", { method: "DELETE", token });
  } catch (err) {
    // Offline: the share still ends by itself at its end time.
    if (err instanceof ApiError && err.status >= 400 && err.status !== 401) throw err;
  }
}

export async function sendPosition(token: string, position: Omit<SharedPosition, "at">): Promise<{ endsAt: string | null }> {
  return api("/location/position", { method: "POST", token, json: position });
}

/** People sharing with you; the last answer is shown again without coverage. */
export async function fetchSharedWithMe(token: string): Promise<FriendShare[]> {
  return (await cached(`${USER_SCOPE}shared-with-me`, () => api<{ people: FriendShare[] }>("/location/shared-with-me", { token }))).people;
}

/** Metres between two points (haversine). */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Sent when you've moved this far … */
export const SEND_DISTANCE_M = 50;
/** … but not more often than this … */
export const SEND_MIN_INTERVAL_MS = 60_000;
/** … and at least this often while the app is open, even standing still. */
export const SEND_HEARTBEAT_MS = 5 * 60_000;

/**
 * Whether a new fix is worth sending. Few sends keep the worker's daily
 * request budget (and the battery) for the rest of the app.
 */
export function shouldSend(last: { lat: number; lon: number; at: number } | null, next: { lat: number; lon: number }, now: number): boolean {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed >= SEND_HEARTBEAT_MS) return true;
  return elapsed >= SEND_MIN_INTERVAL_MS && distanceM(last, next) >= SEND_DISTANCE_M;
}
