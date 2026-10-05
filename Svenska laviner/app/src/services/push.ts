import { Capacitor } from "@capacitor/core";
import { api } from "./api";

/**
 * Web push for "farograden ändrades i mina områden". Browser only for now:
 * the native apps need Firebase/APNs, which aren't set up. iPhones get web
 * push only once the site has been added to the home screen.
 */
export function pushSupported(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The worker's public VAPID key, or null while notifications aren't set up there. */
export async function fetchPushKey(): Promise<string | null> {
  try {
    return (await api<{ publicKey: string | null }>("/push/key")).publicKey;
  } catch {
    return null;
  }
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64Url.length + 3) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

// One browser has one push subscription, shared by two kinds of
// notifications: danger levels in favourite regions (anonymous) and
// notifications for the signed-in account. Each kind keeps a flag on the
// device, and the subscription itself is only cancelled when neither
// needs it any more.
type PushPurpose = "regions" | "account";
const flagKey = (p: PushPurpose) => `fjallkoll:push-${p}`;

function hasFlag(p: PushPurpose): boolean {
  try {
    return localStorage.getItem(flagKey(p)) === "1";
  } catch {
    return false;
  }
}

function setFlag(p: PushPurpose, on: boolean) {
  try {
    if (on) localStorage.setItem(flagKey(p), "1");
    else localStorage.removeItem(flagKey(p));
  } catch {
    // Without storage the subscription is simply kept.
  }
}

/** Before these flags existed, a subscription always meant danger-level notices. */
function noFlagsYet(): boolean {
  try {
    return localStorage.getItem(flagKey("regions")) === null && localStorage.getItem(flagKey("account")) === null;
  } catch {
    return true;
  }
}

/** Whether danger-level notices are on in this browser. */
export async function regionPushEnabled(): Promise<boolean> {
  const sub = await currentSubscription();
  return Boolean(sub) && (hasFlag("regions") || noFlagsYet());
}

async function subscribeBrowser(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notiser är blockerade för den här sidan. Tillåt dem i webbläsarens inställningar.");
  }
  try {
    const reg = await registration();
    return (
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
    );
  } catch {
    // Browsers word these differently (and in English); say what to try instead.
    throw new Error(
      "Webbläsaren kunde inte slå på notiser. Prova Chrome, Firefox eller Edge, eller på iPhone: lägg först till sidan på hemskärmen och öppna den därifrån."
    );
  }
}

/** Cancels the browser subscription once no kind of notification uses it. */
async function releaseBrowser(subscription: PushSubscription) {
  if (!hasFlag("regions") && !hasFlag("account")) await subscription.unsubscribe();
}

/** The current subscription, if this browser already has notifications on. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

async function saveRegions(subscription: PushSubscription, regions: string[]): Promise<void> {
  await api("/push/subscribe", { method: "POST", json: { subscription: subscription.toJSON(), regions } });
}

/** Asks for permission (must follow a tap) and subscribes for these regions. */
export async function enablePush(publicKey: string, regions: string[]): Promise<void> {
  const subscription = await subscribeBrowser(publicKey);
  await saveRegions(subscription, regions);
  setFlag("regions", true);
}

/** Keeps the server's region list in step with the favourites. */
export async function updatePushRegions(regions: string[]): Promise<void> {
  const subscription = await currentSubscription();
  if (subscription) await saveRegions(subscription, regions);
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await api("/push/unsubscribe", { method: "POST", json: { endpoint: subscription.endpoint } });
  } finally {
    setFlag("regions", false);
    await releaseBrowser(subscription);
  }
}

/** Whether this browser gets push for the signed-in account (asks the server). */
export async function accountPushEnabled(token: string): Promise<boolean> {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  try {
    return (
      await api<{ enabled: boolean }>("/notifications/push/status", {
        method: "POST",
        token,
        json: { endpoint: subscription.endpoint },
      })
    ).enabled;
  } catch {
    return false;
  }
}

/** Push for followers, comments and likes on this account. */
export async function enableAccountPush(publicKey: string, token: string): Promise<void> {
  // Keep danger-level notices working if they were on before the flags existed.
  if (noFlagsYet() && (await currentSubscription())) setFlag("regions", true);
  const subscription = await subscribeBrowser(publicKey);
  await api("/notifications/push", { method: "POST", token, json: { subscription: subscription.toJSON() } });
  setFlag("account", true);
}

export async function disableAccountPush(token: string): Promise<void> {
  const subscription = await currentSubscription();
  setFlag("account", false);
  if (!subscription) return;
  try {
    await api("/notifications/push/off", { method: "POST", token, json: { endpoint: subscription.endpoint } });
  } finally {
    await releaseBrowser(subscription);
  }
}
