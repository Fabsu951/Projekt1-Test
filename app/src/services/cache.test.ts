import { beforeEach, describe, expect, it, vi } from "vitest";
import { withCache } from "./cache";

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
