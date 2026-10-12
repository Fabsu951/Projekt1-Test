import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const calls: Array<{ path: string; token?: string | null; json?: unknown }> = [];
const listeners: Record<string, (e: unknown) => void> = {};
let permission = "granted";
let tokenError: string | null = null;

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
  },
}));
vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: {
    checkPermissions: async () => ({ receive: permission }),
    requestPermissions: async () => ({ receive: permission === "prompt" ? (permission = "granted") : permission }),
    getToken: async () => {
      if (tokenError) throw new Error(tokenError);
      return { token: "fcm-token-1" };
    },
    addListener: async (name: string, fn: (e: unknown) => void) => {
      listeners[name] = fn;
      return { remove: async () => {} };
    },
  },
}));
vi.mock("./api", () => ({
  api: async (path: string, opts: { token?: string | null; json?: { regions?: string[]; account?: boolean } } = {}) => {
    calls.push({ path, token: opts.token, json: opts.json });
    if (path === "/native/status") return { enabled: true };
    return { regions: opts.json?.regions ?? [], account: Boolean(opts.json?.account && opts.token) };
  },
}));

const push = await import("./nativePush");

beforeEach(() => {
  store.clear();
  calls.length = 0;
  permission = "prompt";
  tokenError = null;
});

describe("app push (Firebase)", () => {
  it("asks for permission and registers the starred areas", async () => {
    expect(await push.nativePushAvailable()).toBe(true);
    await push.enableNativeRegionPush(["riksgransfjallen"], null);
    expect(calls.at(-1)).toEqual({
      path: "/native/register",
      token: null,
      json: { token: "fcm-token-1", platform: "android", regions: ["riksgransfjallen"], account: false, lang: "sv" },
    });
    expect(await push.nativeRegionPushEnabled()).toBe(true);
  });

  it("hides Firebase's raw error when the app was built without its settings, and stops offering push", async () => {
    tokenError =
      "Default FirebaseApp is not initialized in this process se.snolage.app. Make sure to call FirebaseApp.initializeApp(Context) first.";
    const attempt = push.enableNativeRegionPush(["riksgransfjallen"], null);
    await expect(attempt).rejects.toBeInstanceOf(push.NativePushMissingError);
    await expect(push.enableNativeAccountPush("auth-1")).rejects.toThrow(/den här versionen av appen/);
    expect(calls.filter((c) => c.path === "/native/register")).toHaveLength(0);
    expect(await push.nativePushAvailable()).toBe(false);
  });

  it("explains in Swedish when notifications are blocked, and sends nothing", async () => {
    permission = "denied";
    await expect(push.enableNativeRegionPush(["riksgransfjallen"], null)).rejects.toThrow(/Inställningar/);
    expect(calls.filter((c) => c.path === "/native/register")).toHaveLength(0);
  });

  it("keeps area and account notices apart, and logout only stops the account's", async () => {
    await push.enableNativeRegionPush(["kebnekaisefjallen"], "auth-1");
    await push.enableNativeAccountPush("auth-1");
    expect(calls.at(-1)).toMatchObject({ token: "auth-1", json: { regions: ["kebnekaisefjallen"], account: true } });
    expect(await push.nativeAccountPushEnabled()).toBe(true);

    await push.stopNativeAccountPush();
    expect(calls.at(-1)).toMatchObject({ token: null, json: { regions: ["kebnekaisefjallen"], account: false } });
    expect(await push.nativeAccountPushEnabled()).toBe(false);
    expect(await push.nativeRegionPushEnabled()).toBe(true);
  });

  it("follows the favourites only while area notices are on", async () => {
    permission = "granted";
    await push.updateNativeRegions(["riksgransfjallen"], null);
    expect(calls).toHaveLength(0);
    await push.enableNativeRegionPush(["riksgransfjallen"], null);
    await push.updateNativeRegions(["riksgransfjallen", "kebnekaisefjallen"], null);
    expect(calls.at(-1)!.json).toMatchObject({ regions: ["riksgransfjallen", "kebnekaisefjallen"] });
    await push.disableNativeRegionPush(null);
    expect(calls.at(-1)!.json).toMatchObject({ regions: [], account: false });
    expect(await push.nativeRegionPushEnabled()).toBe(false);
  });

  it("opens the notification's page when tapped, but never an outside address", async () => {
    const opened: string[] = [];
    push.listenForNativePush((p) => opened.push(p), () => null);
    await Promise.resolve();
    listeners.notificationActionPerformed({ notification: { data: { url: "/omrade/riksgransfjallen" } } });
    listeners.notificationActionPerformed({ notification: { data: { url: "//evil.example" } } });
    listeners.notificationActionPerformed({ notification: { data: { url: "https://evil.example" } } });
    expect(opened).toEqual(["/omrade/riksgransfjallen"]);
  });
});
