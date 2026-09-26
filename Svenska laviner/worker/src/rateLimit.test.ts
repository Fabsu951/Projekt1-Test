import { describe, expect, it } from "vitest";
import { clear, enforce, record, type RateLimitStore } from "./rateLimit";
import { HttpError } from "./http";

function memoryStore() {
  const events: Array<{ key: string; at: string }> = [];
  const store: RateLimitStore = {
    async count(key, since) {
      return events.filter((e) => e.key === key && e.at > since).length;
    },
    async add(key, at) {
      events.push({ key, at });
    },
    async clear(key) {
      for (let i = events.length - 1; i >= 0; i--) if (events[i].key === key) events.splice(i, 1);
    },
    async pruneBefore(iso) {
      for (let i = events.length - 1; i >= 0; i--) if (events[i].at < iso) events.splice(i, 1);
    },
  };
  return { store, events };
}

const LIMIT = { key: "login-email:a@b.se", max: 3, windowMs: 15 * 60 * 1000 };
const at = (minutes: number) => new Date(Date.UTC(2027, 0, 20, 10, minutes));

describe("rate limits", () => {
  it("blocks once the limit is used up within the window", async () => {
    const { store } = memoryStore();
    for (let i = 0; i < 3; i++) {
      await enforce(store, [LIMIT], "stopp", at(i));
      await record(store, [LIMIT.key], at(i));
    }
    await expect(enforce(store, [LIMIT], "stopp", at(5))).rejects.toMatchObject({ status: 429, message: "stopp" });
    await expect(enforce(store, [LIMIT], "stopp", at(5))).rejects.toBeInstanceOf(HttpError);
  });

  it("lets attempts through again once the window has passed", async () => {
    const { store } = memoryStore();
    for (let i = 0; i < 3; i++) await record(store, [LIMIT.key], at(i));
    await expect(enforce(store, [LIMIT], "stopp", at(20))).resolves.toBeUndefined();
  });

  it("is reset by a successful login", async () => {
    const { store } = memoryStore();
    for (let i = 0; i < 3; i++) await record(store, [LIMIT.key], at(i));
    await clear(store, LIMIT.key);
    await expect(enforce(store, [LIMIT], "stopp", at(5))).resolves.toBeUndefined();
  });

  it("stores hashed keys only, and forgets events after a day", async () => {
    const { store, events } = memoryStore();
    await record(store, [LIMIT.key, "login-ip:203.0.113.7"], at(0));
    expect(events.map((e) => e.key).join()).not.toMatch(/a@b\.se|203\.0\.113/);
    await enforce(store, [LIMIT], "stopp", new Date(at(0).getTime() + 25 * 3600 * 1000));
    expect(events).toHaveLength(0);
  });
});
