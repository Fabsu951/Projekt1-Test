import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), api }));

import { ApiError } from "./api";
import { activeShare, distanceM, SHARE_CHANGED_EVENT, shouldSend, startSharing, stopSharing } from "./locationShare";

beforeEach(() => {
  localStorage.clear();
  api.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("when to send a position", () => {
  const at = Date.UTC(2026, 1, 14, 9);
  const here = { lat: 67.9, lon: 18.5 };

  it("measures distances on the ground", () => {
    expect(distanceM(here, { lat: 67.9009, lon: 18.5 })).toBeCloseTo(100, -1);
  });

  it("sends the first fix, then only after a real move or a while", () => {
    expect(shouldSend(null, here, at)).toBe(true);
    const last = { ...here, at };
    // Moved 100 m but only 30 s later: wait.
    expect(shouldSend(last, { lat: 67.9009, lon: 18.5 }, at + 30_000)).toBe(false);
    // Moved 100 m a minute later: send.
    expect(shouldSend(last, { lat: 67.9009, lon: 18.5 }, at + 61_000)).toBe(true);
    // Moved 20 m four minutes later: wait.
    expect(shouldSend(last, { lat: 67.90018, lon: 18.5 }, at + 4 * 60_000)).toBe(false);
    // Standing still for five minutes: send anyway, so friends see it's fresh.
    expect(shouldSend(last, here, at + 5 * 60_000)).toBe(true);
  });
});

describe("the running share on this device", () => {
  it("is remembered for the account that started it, until it ends", async () => {
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    api.mockResolvedValueOnce({ share: { startedAt: new Date().toISOString(), endsAt, position: null, viewers: [] } });
    const changed = vi.fn();
    window.addEventListener(SHARE_CHANGED_EVENT, changed);
    await startSharing("tok", 7, [2, 3], 1);
    expect(api).toHaveBeenCalledWith("/location/share", { method: "POST", token: "tok", json: { viewerIds: [2, 3], hours: 1 } });
    expect(changed).toHaveBeenCalled();
    expect(await activeShare(7)).toEqual({ userId: 7, endsAt });
    expect(await activeShare(8)).toBeNull(); // someone else on the same phone
    expect(await activeShare(7, Date.now() + 2 * 3600_000)).toBeNull(); // ended
    window.removeEventListener(SHARE_CHANGED_EVENT, changed);
  });

  it("is forgotten when stopped, also without coverage", async () => {
    api.mockResolvedValueOnce({ share: { startedAt: "", endsAt: new Date(Date.now() + 3600_000).toISOString(), position: null, viewers: [] } });
    await startSharing("tok", 7, [2], 1);
    api.mockRejectedValueOnce(new ApiError(0, "offline"));
    await stopSharing("tok");
    expect(api).toHaveBeenLastCalledWith("/location/share", { method: "DELETE", token: "tok" });
    expect(await activeShare(7)).toBeNull();
  });
});
