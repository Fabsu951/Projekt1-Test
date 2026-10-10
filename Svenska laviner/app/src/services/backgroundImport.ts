import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// "Påminn mig om nya skidpass" (Android app only): about once an hour, also
// when the app is closed, the phone checks Health Connect for new winter
// sessions and shows a notification that opens /turer/halsa. The native side
// is BackgroundImport.kt; it never sends anything anywhere by itself.

export interface BackgroundCheckStatus {
  /** Health Connect on this phone can read in the background at all. */
  supported: boolean;
  /** Turned on, and Health Connect still allows it. */
  on: boolean;
}

export type EnableResult = { on: true } | { on: false; reason: "notifications" | "workouts" | "background" | "error" };

interface BackgroundImportPlugin {
  status(): Promise<{ supported: boolean; enabled: boolean; backgroundPermission?: boolean; notifications?: boolean }>;
  enable(): Promise<{ enabled: boolean; reason?: string }>;
  disable(): Promise<{ enabled: boolean }>;
  takeLaunchPath(): Promise<{ path?: string | null }>;
  addListener(event: "openPath", listener: (event: { path: string }) => void): Promise<PluginListenerHandle>;
}

const BackgroundImport = registerPlugin<BackgroundImportPlugin>("BackgroundImport");

export function backgroundCheckAvailable(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("BackgroundImport");
}

/** Null where there is no background check (web, iPhone, older app builds) or it can't be read. */
export async function backgroundCheckStatus(): Promise<BackgroundCheckStatus | null> {
  if (!backgroundCheckAvailable()) return null;
  try {
    const s = await BackgroundImport.status();
    return { supported: s.supported, on: s.enabled && !!s.backgroundPermission && s.notifications !== false };
  } catch {
    return null;
  }
}

const REASONS = new Set(["notifications", "workouts", "background"]);

/** Asks for notifications and Health Connect's background permission, then starts the check. */
export async function enableBackgroundCheck(): Promise<EnableResult> {
  try {
    const r = await BackgroundImport.enable();
    if (r.enabled) return { on: true };
    return { on: false, reason: REASONS.has(r.reason ?? "") ? (r.reason as "notifications" | "workouts" | "background") : "error" };
  } catch {
    return { on: false, reason: "error" };
  }
}

export async function disableBackgroundCheck(): Promise<void> {
  await BackgroundImport.disable();
}

/** Only paths inside the app ("/turer/halsa"), never "//host" or full addresses. */
const inAppPath = (path: unknown): path is string => typeof path === "string" && /^\/(?!\/)/.test(path);

/**
 * Opens the page a tapped reminder points to: once for the notification that
 * started the app, and again for each one tapped while it runs.
 */
export function listenForReminderTaps(open: (path: string) => void): () => void {
  if (!backgroundCheckAvailable()) return () => {};
  let handle: PluginListenerHandle | null = null;
  let stopped = false;
  void BackgroundImport.takeLaunchPath()
    .then(({ path }) => {
      if (!stopped && inAppPath(path)) open(path);
    })
    .catch(() => {});
  void BackgroundImport.addListener("openPath", ({ path }) => {
    if (inAppPath(path)) open(path);
  }).then((h) => {
    if (stopped) void h.remove();
    else handle = h;
  });
  return () => {
    stopped = true;
    void handle?.remove();
  };
}
