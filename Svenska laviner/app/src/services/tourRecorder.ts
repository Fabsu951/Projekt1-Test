import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { fixLine } from "../utils/recording";

// "Spela in tur": records the GPS track on the phone, like starting an
// activity in a sports app instead of on the watch. In the apps a native
// recorder keeps going with the screen off (TourRecorderService.kt on
// Android with a notification, TourRecorderPlugin.swift on iPhone with the
// blue location indicator). In a browser the page records while it is open
// and asks the screen to stay on. Either way the track stays on the device
// until it is saved as a tour (NewTourPage ?inspelning=1).

export type RecordingState = "idle" | "recording" | "paused" | "finished";

export interface RecordingStatus {
  state: RecordingState;
  /** When it started, ms. */
  startedAt: number;
  /** Time spent paused so far, ms. */
  pausedMs: number;
}

export type StartResult = { started: true } | { started: false; reason: "location" | "unsupported" | "service" };

/** Fired on start, pause, resume, finish and discard, so the banner and pages follow. */
export const RECORDING_CHANGED_EVENT = "fjallkoll:recording-changed";

interface TourRecorderPlugin {
  start(): Promise<{ started: boolean; reason?: string }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  finish(): Promise<void>;
  discard(): Promise<void>;
  status(): Promise<{ state: RecordingState; running: boolean; startedAt: number; pausedMs: number }>;
  read(options: { from: number }): Promise<{ lines: string[]; total: number }>;
}

const TourRecorder = registerPlugin<TourRecorderPlugin>("TourRecorder");

/** True in the Android and iPhone apps, where recording goes on with the screen off. */
export function nativeRecording(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TourRecorder");
}

function changed(): void {
  window.dispatchEvent(new Event(RECORDING_CHANGED_EVENT));
}

// --- Browser recorder -------------------------------------------------------

const WEB_KEY = "fjallkoll:tour-recording";

interface WebRecording extends RecordingStatus {
  pausedAt: number | null;
  lines: string[];
}

function loadWeb(): WebRecording | null {
  try {
    const raw = localStorage.getItem(WEB_KEY);
    return raw ? (JSON.parse(raw) as WebRecording) : null;
  } catch {
    return null;
  }
}

function saveWeb(rec: WebRecording | null): void {
  try {
    if (rec) localStorage.setItem(WEB_KEY, JSON.stringify(rec));
    else localStorage.removeItem(WEB_KEY);
  } catch {
    // Storage full or blocked: the recording lives on in memory while the page is open.
  }
}

let webWatch: Promise<string> | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;

async function keepScreenOn(on: boolean): Promise<void> {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
  try {
    if (on && !wakeLock && nav.wakeLock && document.visibilityState === "visible") wakeLock = await nav.wakeLock.request("screen");
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

if (typeof document !== "undefined") {
  // The browser drops the wake lock when the tab is hidden; take it again on return.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && loadWeb()?.state === "recording") {
      wakeLock = null;
      void keepScreenOn(true);
    }
  });
}

function startWebWatch(): void {
  if (webWatch) return;
  webWatch = Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }, (pos) => {
    if (!pos) return;
    const rec = loadWeb();
    if (!rec || rec.state !== "recording") return;
    const c = pos.coords;
    rec.lines.push(fixLine(c.latitude, c.longitude, c.altitude ?? null, Math.min(pos.timestamp || Date.now(), Date.now()), c.accuracy ?? null));
    saveWeb(rec);
  });
  void keepScreenOn(true);
}

function stopWebWatch(): void {
  const watch = webWatch;
  webWatch = null;
  if (watch) void watch.then((id) => Geolocation.clearWatch({ id })).catch(() => {});
  void keepScreenOn(false);
}

// --- One API for both -------------------------------------------------------

async function locationAllowed(): Promise<boolean> {
  try {
    let { location } = await Geolocation.checkPermissions();
    if (location !== "granted") ({ location } = await Geolocation.requestPermissions({ permissions: ["location"] }));
    return location === "granted";
  } catch {
    return false;
  }
}

export async function startRecording(): Promise<StartResult> {
  if (nativeRecording()) {
    if (!(await locationAllowed())) return { started: false, reason: "location" };
    const result = await TourRecorder.start();
    changed();
    return result.started ? { started: true } : { started: false, reason: result.reason === "location" ? "location" : "service" };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return { started: false, reason: "unsupported" };
  saveWeb({ state: "recording", startedAt: Date.now(), pausedMs: 0, pausedAt: null, lines: [] });
  startWebWatch();
  changed();
  return { started: true };
}

export async function pauseRecording(): Promise<void> {
  if (nativeRecording()) await TourRecorder.pause();
  else {
    const rec = loadWeb();
    if (rec?.state === "recording") {
      const now = Date.now();
      saveWeb({ ...rec, state: "paused", pausedAt: now, lines: [...rec.lines, `P,${now}`] });
      stopWebWatch();
    }
  }
  changed();
}

export async function resumeRecording(): Promise<void> {
  if (nativeRecording()) await TourRecorder.resume();
  else {
    const rec = loadWeb();
    if (rec?.state === "paused") {
      const now = Date.now();
      saveWeb({ ...rec, state: "recording", pausedMs: rec.pausedMs + (now - (rec.pausedAt ?? now)), pausedAt: null, lines: [...rec.lines, `R,${now}`] });
      startWebWatch();
    }
  }
  changed();
}

export async function finishRecording(): Promise<void> {
  if (nativeRecording()) await TourRecorder.finish();
  else {
    const rec = loadWeb();
    if (rec && (rec.state === "recording" || rec.state === "paused")) {
      const now = Date.now();
      const pausedMs = rec.pausedAt ? rec.pausedMs + (now - rec.pausedAt) : rec.pausedMs;
      saveWeb({ ...rec, state: "finished", pausedMs, pausedAt: null });
    }
    stopWebWatch();
  }
  changed();
}

/** Throws the recording away (after saving it as a tour, or when the user says so). */
export async function discardRecording(): Promise<void> {
  if (nativeRecording()) await TourRecorder.discard();
  else {
    stopWebWatch();
    saveWeb(null);
  }
  changed();
}

export async function recordingStatus(): Promise<RecordingStatus> {
  if (nativeRecording()) {
    try {
      const s = await TourRecorder.status();
      return { state: s.state, startedAt: s.startedAt, pausedMs: s.pausedMs };
    } catch {
      return { state: "idle", startedAt: 0, pausedMs: 0 };
    }
  }
  const rec = loadWeb();
  if (!rec) return { state: "idle", startedAt: 0, pausedMs: 0 };
  const pausedMs = rec.pausedAt ? rec.pausedMs + (Date.now() - rec.pausedAt) : rec.pausedMs;
  return { state: rec.state, startedAt: rec.startedAt, pausedMs };
}

/** The recorded lines from line `from` on (for reading only what is new). */
export async function readRecording(from = 0): Promise<{ lines: string[]; total: number }> {
  if (nativeRecording()) return TourRecorder.read({ from });
  const lines = loadWeb()?.lines ?? [];
  return { lines: lines.slice(from), total: lines.length };
}

/**
 * At app start: a recording that was going on carries on. The native
 * recorder may have been stopped by the system; in a browser the page was
 * reloaded and has to follow the position again.
 */
export async function keepRecordingAlive(): Promise<void> {
  if (nativeRecording()) {
    try {
      const s = await TourRecorder.status();
      if (s.state === "recording" && !s.running) await TourRecorder.resume();
    } catch {
      // No recorder: nothing to carry on.
    }
    return;
  }
  if (loadWeb()?.state === "recording") startWebWatch();
}
