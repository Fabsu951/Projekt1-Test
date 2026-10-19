import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: 7 }, token: "tok" } }));
const native = vi.hoisted(() => {
  const listeners: Record<string, (e: unknown) => void> = {};
  return {
    listeners,
    available: true,
    plugin: {
      start: vi.fn(async () => ({ started: true })),
      stop: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ running: false })),
      addListener: vi.fn(async (event: string, cb: (e: unknown) => void) => {
        listeners[event] = cb;
        return { remove: async () => undefined };
      }),
    },
  };
});
const geo = vi.hoisted(() => ({ watchPosition: vi.fn(async () => "w1"), clearWatch: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: geo }));
vi.mock("../services/nativeShare", () => ({
  ShareLocation: native.plugin,
  backgroundSharing: () => native.available,
  stopBackgroundSharing: async () => undefined,
}));

import LocationShareBridge from "./LocationShareBridge";
import { activeShare, lingeringShare } from "../services/locationShare";

const endsAt = () => new Date(Date.now() + 3600_000).toISOString();

describe("LocationShareBridge in the apps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    native.available = true;
  });

  it("hands a running share to the native background sender, once", async () => {
    const ends = endsAt();
    localStorage.setItem("CapacitorStorage.fjallkoll:location-share", JSON.stringify({ userId: 7, endsAt: ends }));
    render(<LocationShareBridge />);
    await waitFor(() => expect(native.plugin.start).toHaveBeenCalledTimes(1));
    const options = (native.plugin.start.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(options).toMatchObject({ token: "tok", endsAt: Date.parse(ends), stopText: "Stoppa" });
    expect(String(options.text)).toMatch(/^Snöläge delar din position till kl\. \d\d:\d\d\.$/);
    // The page doesn't follow the position itself in the apps.
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it("doesn't start a second sender when one runs", async () => {
    native.plugin.status.mockResolvedValueOnce({ running: true });
    localStorage.setItem("CapacitorStorage.fjallkoll:location-share", JSON.stringify({ userId: 7, endsAt: endsAt() }));
    render(<LocationShareBridge />);
    await waitFor(() => expect(native.plugin.status).toHaveBeenCalled());
    expect(native.plugin.start).not.toHaveBeenCalled();
  });

  it("forgets the share when the sender reports it stopped, and remembers the last point when it ran out", async () => {
    localStorage.setItem("CapacitorStorage.fjallkoll:location-share", JSON.stringify({ userId: 7, endsAt: endsAt() }));
    render(<LocationShareBridge />);
    await waitFor(() => expect(native.listeners.stopped).toBeDefined());
    native.listeners.stopped({ reason: "ended" });
    await waitFor(async () => expect(await activeShare(7)).toBeNull());
    expect(await lingeringShare(7)).not.toBeNull();
  });

  it("follows the position itself when the native sender refuses to start", async () => {
    native.plugin.start.mockRejectedValueOnce(new Error("Saknar uppgifter"));
    localStorage.setItem("CapacitorStorage.fjallkoll:location-share", JSON.stringify({ userId: 7, endsAt: endsAt() }));
    render(<LocationShareBridge />);
    await waitFor(() => expect(geo.watchPosition).toHaveBeenCalled());
  });

  it("follows the position itself in a browser", async () => {
    native.available = false;
    localStorage.setItem("CapacitorStorage.fjallkoll:location-share", JSON.stringify({ userId: 7, endsAt: endsAt() }));
    render(<LocationShareBridge />);
    await waitFor(() => expect(geo.watchPosition).toHaveBeenCalled());
    expect(native.plugin.start).not.toHaveBeenCalled();
  });
});
