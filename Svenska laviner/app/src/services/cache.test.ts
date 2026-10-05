import { beforeEach, describe, expect, it, vi } from "vitest";
import { cached, clearUserCache, savedAt, SHOWING_SAVED_EVENT, USER_SCOPE, withCache } from "./cache";
import { ApiError } from "./api";

beforeEach(() => {
  localStorage.clear();
});

describe("withCache", () => {
  it("returns fresh data and caches it on success", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const result = await withCache("test-key", fetcher);

    expect(result.data).toEqual({ value: 42 });
    expect(result.stale).toBe(false);
    expect(result.cachedAt).not.toBeNull();
  });

  it("falls back to cached data when the fetch fails", async () => {
    await withCache("test-key", () => Promise.resolve({ value: 1 }));

    const failing = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await withCache("test-key", failing);

    expect(result.data).toEqual({ value: 1 });
    expect(result.stale).toBe(true);
  });

  it("rethrows the original error when there is nothing cached", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(withCache("missing-key", failing)).rejects.toThrow("network down");
  });
});

describe("cached", () => {
  it("saves fresh data and returns it", async () => {
    expect(await cached("c1", () => Promise.resolve([1, 2]))).toEqual([1, 2]);
    expect(await savedAt("c1")).not.toBeNull();
  });

  it("falls back to the saved answer when there is no connection, and says so", async () => {
    await cached("c2", () => Promise.resolve("old"));
    const seen = vi.fn();
    window.addEventListener(SHOWING_SAVED_EVENT, seen);
    const result = await cached("c2", () => Promise.reject(new ApiError(0, "Ingen kontakt")));
    window.removeEventListener(SHOWING_SAVED_EVENT, seen);
    expect(result).toBe("old");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("passes on server answers such as not found instead of old data", async () => {
    await cached("c3", () => Promise.resolve("old"));
    await expect(cached("c3", () => Promise.reject(new ApiError(404, "Hittades inte")))).rejects.toThrow("Hittades inte");
  });

  it("rethrows when nothing is saved", async () => {
    await expect(cached("c4", () => Promise.reject(new ApiError(0, "Ingen kontakt")))).rejects.toThrow("Ingen kontakt");
  });

  it("clearUserCache forgets only account data", async () => {
    await cached(`${USER_SCOPE}routes`, () => Promise.resolve([1]));
    await cached("observations:", () => Promise.resolve([2]));
    await clearUserCache();
    expect(await savedAt(`${USER_SCOPE}routes`)).toBeNull();
    expect(await savedAt("observations:")).not.toBeNull();
  });
});
