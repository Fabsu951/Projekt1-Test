import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { api } from "./api";
import { t } from "../i18n";

// Push in the Android and iOS apps, through Firebase Cloud Messaging (which
// hands iPhone messages to Apple). The browser version uses web push
// (services/push.ts); the same toggles drive both. The device remembers what
// it asked for and sends the whole wish list to the worker each time, so a
// new FCM token or a logout just re-registers.

const STATE_KEY = "fjallkoll:native-push";

interface NativePushState {
  /** Areas for danger-level notices. */
  regions: string[];
  /** Notices for the signed-in account (followers, comments, likes). */
  account: boolean;
}

const EMPTY: NativePushState = { regions: [], account: false };

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Whether the worker can send app notices (it has the Firebase secret). */
export async function nativePushAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    return (await api<{ enabled: boolean }>("/native/status")).enabled;
  } catch {
    return false;
  }
}

async function loadState(): Promise<NativePushState> {
  try {
    const { value } = await Preferences.get({ key: STATE_KEY });
    const parsed = value ? (JSON.parse(value) as Partial<NativePushState>) : {};
    return {
      regions: Array.isArray(parsed.regions) ? parsed.regions.filter((r): r is string => typeof r === "string") : [],
      account: parsed.account === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

async function saveState(state: NativePushState) {
  await Preferences.set({ key: STATE_KEY, value: JSON.stringify(state) });
}

/** Asks for permission (must follow a tap the first time) and returns this device's FCM token. */
async function deviceToken(ask: boolean): Promise<string> {
  let { receive } = await FirebaseMessaging.checkPermissions();
  if (receive !== "granted" && ask) receive = (await FirebaseMessaging.requestPermissions()).receive;
  if (receive !== "granted") {
    throw new Error(t("Notiser är avstängda för Snöläge. Slå på dem under Inställningar → Appar → Snöläge → Notiser."));
  }
  return (await FirebaseMessaging.getToken()).token;
}

/** Sends the wish list to the worker (an empty one makes it forget the device). */
async function register(state: NativePushState, authToken: string | null, ask = true): Promise<void> {
  const nothing = state.regions.length === 0 && !state.account;
  let token: string;
  try {
    token = await deviceToken(ask && !nothing);
  } catch (err) {
    if (nothing) return; // Turning everything off needs no permission.
    throw err;
  }
  const result = await api<{ regions: string[]; account: boolean }>("/native/register", {
    method: "POST",
    token: state.account ? authToken : null,
    json: { token, platform: Capacitor.getPlatform(), regions: state.regions, account: state.account },
  });
  await saveState({ regions: result.regions, account: result.account });
}

export async function nativeRegionPushEnabled(): Promise<boolean> {
  return (await loadState()).regions.length > 0;
}

export async function enableNativeRegionPush(regions: string[], authToken: string | null): Promise<void> {
  await register({ ...(await loadState()), regions }, authToken);
}

export async function updateNativeRegions(regions: string[], authToken: string | null): Promise<void> {
  const state = await loadState();
  if (state.regions.length > 0) await register({ ...state, regions }, authToken, false);
}

export async function disableNativeRegionPush(authToken: string | null): Promise<void> {
  await register({ ...(await loadState()), regions: [] }, authToken, false);
}

export async function nativeAccountPushEnabled(): Promise<boolean> {
  return (await loadState()).account;
}

export async function enableNativeAccountPush(authToken: string): Promise<void> {
  await register({ ...(await loadState()), account: true }, authToken);
}

export async function disableNativeAccountPush(authToken: string | null): Promise<void> {
  await register({ ...(await loadState()), account: false }, authToken, false);
}

/** On logout: this phone stops getting the account's notices (area notices stay). */
export async function stopNativeAccountPush(): Promise<void> {
  if (!isNativeApp()) return;
  const state = await loadState();
  if (!state.account) return;
  try {
    await register({ ...state, account: false }, null, false);
  } catch {
    // Offline: forget locally; the server drops the link when the token is next re-registered.
    await saveState({ ...state, account: false });
  }
}

let listening = false;

/**
 * Starts listening once per app run: re-registers when Firebase hands out a
 * new token, and opens the right page when a notification is tapped.
 */
export function listenForNativePush(open: (path: string) => void, authToken: () => string | null): void {
  if (!isNativeApp() || listening) return;
  listening = true;
  void FirebaseMessaging.addListener("tokenReceived", async () => {
    const state = await loadState();
    if (state.regions.length || state.account) await register(state, authToken(), false).catch(() => {});
  });
  void FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
    const url = (event.notification.data as { url?: unknown } | undefined)?.url;
    // Only paths inside the app.
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) open(url);
  });
}
