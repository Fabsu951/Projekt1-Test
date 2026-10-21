import { afterEach, describe, expect, it, vi } from "vitest";
import { timedFetch } from "./timedFetch";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("timedFetch", () => {
  it("gives up on a request that hangs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))))
    );
    const result = timedFetch("https://worker.example/forecasts", {}, 1000);
    const check = expect(result).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(1000);
    await check;
  });

  it("passes the answer on, and follows the caller's own abort", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    expect(await (await timedFetch("https://worker.example/x")).text()).toBe("ok");
    const outer = new AbortController();
    outer.abort();
    await timedFetch("https://worker.example/x", { signal: outer.signal });
    const signal = (vi.mocked(fetch).mock.calls[1][1] as RequestInit).signal!;
    expect(signal.aborted).toBe(true);
  });
});
