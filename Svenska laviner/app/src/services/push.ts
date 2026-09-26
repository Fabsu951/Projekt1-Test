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
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notiser är blockerade för den här sidan. Tillåt dem i webbläsarens inställningar.");
  }
  let subscription: PushSubscription;
  try {
    const reg = await registration();
    subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  } catch {
    // Browsers word these differently (and in English); say what to try instead.
    throw new Error(
      "Webbläsaren kunde inte slå på notiser. Prova Chrome, Firefox eller Edge, eller på iPhone: lägg först till sidan på hemskärmen och öppna den därifrån."
    );
  }
  await saveRegions(subscription, regions);
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
    await subscription.unsubscribe();
  }
}
