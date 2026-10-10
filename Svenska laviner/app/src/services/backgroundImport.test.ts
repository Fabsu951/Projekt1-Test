import { beforeEach, describe, expect, it, vi } from "vitest";

const { plugin, env } = vi.hoisted(() => ({
  plugin: {
    status: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    takeLaunchPath: vi.fn(),
    addListener: vi.fn(),
  },
  env: { platform: "android" },
}));

vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capacitor/core")>()),
  registerPlugin: () => plugin,
  Capacitor: { getPlatform: () => env.platform, isPluginAvailable: () => true },
}));

import { backgroundCheckStatus, enableBackgroundCheck, listenForReminderTaps } from "./backgroundImport";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("reminders about new sessions from the watch", () => {
  beforeEach(() => {
    env.platform = "android";
    vi.clearAllMocks();
  });

  it("counts as on only while Health Connect and notifications still allow it", async () => {
    plugin.status.mockResolvedValue({ supported: true, enabled: true, backgroundPermission: true, notifications: true });
    expect(await backgroundCheckStatus()).toEqual({ supported: true, on: true });
    plugin.status.mockResolvedValue({ supported: true, enabled: true, backgroundPermission: false, notifications: true });
    expect(await backgroundCheckStatus()).toEqual({ supported: true, on: false });
    plugin.status.mockRejectedValue(new Error("x"));
    expect(await backgroundCheckStatus()).toBeNull();
    env.platform = "web";
    expect(await backgroundCheckStatus()).toBeNull();
  });

  it("says why it couldn't be turned on", async () => {
    plugin.enable.mockResolvedValue({ enabled: false, reason: "background" });
    expect(await enableBackgroundCheck()).toEqual({ on: false, reason: "background" });
    plugin.enable.mockResolvedValue({ enabled: true });
    expect(await enableBackgroundCheck()).toEqual({ on: true });
    plugin.enable.mockRejectedValue(new Error("x"));
    expect(await enableBackgroundCheck()).toEqual({ on: false, reason: "error" });
  });

  it("opens the tapped reminder's page, but only paths inside the app", async () => {
    let tapped: (e: { path: string }) => void = () => {};
    plugin.takeLaunchPath.mockResolvedValue({ path: "/turer/halsa" });
    plugin.addListener.mockImplementation(async (_event: string, fn: typeof tapped) => {
      tapped = fn;
      return { remove: vi.fn() };
    });
    const open = vi.fn();
    const stop = listenForReminderTaps(open);
    await flush();
    tapped({ path: "//evil.example/x" });
    tapped({ path: "https://evil.example" });
    tapped({ path: "/turer/halsa" });
    expect(open.mock.calls).toEqual([["/turer/halsa"], ["/turer/halsa"]]);
    stop();
  });
});
