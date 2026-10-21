/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";
import { changeFrom, type HistoryRow } from "./history";
import { changeMessage, type PushEnv } from "./push";
import { drainOutbox, queueChanges } from "./outbox";
import { migratedD1 } from "./testing/sqliteD1";
import { toBase64Url } from "./webpush";

const row = (date: string, danger: number): HistoryRow => ({ regionId: "kebnekaisefjallen", date, danger, problems: [] });

describe("changeFrom", () => {
  it("reports a changed level against the previous forecast", () => {
    expect(changeFrom(row("2027-01-21", 3), { date: "2027-01-20", danger: 2 })).toEqual({
      regionId: "kebnekaisefjallen",
      date: "2027-01-21",
      from: 2,
      to: 3,
    });
  });

  it("reports a same-day update of the forecast", () => {
    expect(changeFrom(row("2027-01-21", 2), { date: "2027-01-21", danger: 3 })).toMatchObject({ from: 3, to: 2 });
  });

  it("stays quiet when nothing changed, on the very first record, and after a long gap", () => {
    expect(changeFrom(row("2027-01-21", 2), { date: "2027-01-20", danger: 2 })).toBeNull();
    expect(changeFrom(row("2027-01-21", 2), null)).toBeNull();
    expect(changeFrom(row("2026-12-15", 3), { date: "2026-04-20", danger: 1 })).toBeNull();
  });
});

describe("changeMessage", () => {
  it("names the region, the new level and which way it moved", () => {
    const msg = changeMessage({ regionId: "kebnekaisefjallen", date: "2027-01-21", from: 2, to: 3 }, "2027-01-20");
    expect(msg).toEqual({
      title: "Kebnekaisefjällen: 3 Betydande fara",
      body: "Farograden i morgon har höjts från 2 Måttlig fara.",
      url: "/omrade/kebnekaisefjallen",
      tag: "danger-kebnekaisefjallen",
    });
    expect(changeMessage({ regionId: "kebnekaisefjallen", date: "2027-01-20", from: 3, to: 2 }, "2027-01-20").body).toBe(
      "Farograden idag har sänkts från 3 Betydande fara."
    );
  });
});

async function subscriptionKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const pub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return { p256dh: toBase64Url(pub), auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))) };
}

describe("danger-level push", () => {
  async function setup(count: number) {
    const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", vapid.privateKey)) as JsonWebKey;
    const vapidPublic = new Uint8Array((await crypto.subtle.exportKey("raw", vapid.publicKey)) as ArrayBuffer);
    const env = {
      DB: migratedD1(),
      VAPID_PUBLIC_KEY: toBase64Url(vapidPublic),
      VAPID_PRIVATE_KEY: jwk.d!,
      VAPID_SUBJECT: "mailto:test@example.se",
    } satisfies PushEnv;
    const subs = [
      { endpoint: "https://fcm.googleapis.com/a", regions: '["kebnekaisefjallen"]' },
      { endpoint: "https://fcm.googleapis.com/b", regions: '["riksgransfjallen"]' },
      { endpoint: "https://fcm.googleapis.com/gone", regions: '["kebnekaisefjallen"]' },
      ...Array.from({ length: count }, (_, i) => ({ endpoint: `https://fcm.googleapis.com/many-${i}`, regions: '["kebnekaisefjallen"]' })),
    ];
    for (const sub of subs) {
      const k = await subscriptionKeys();
      await env.DB.prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth, regions, created_at, updated_at) VALUES (?, ?, ?, ?, '', '')")
        .bind(sub.endpoint, k.p256dh, k.auth, sub.regions)
        .run();
    }
    return env;
  }
  const change = [{ regionId: "kebnekaisefjallen", date: "2027-01-21", from: 2, to: 3 }];
  const now = new Date("2027-01-20T17:30:00Z");

  it("queues a notice per subscriber of the changed area, sends them and deletes gone subscriptions", async () => {
    const env = await setup(0);
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      new Response(null, { status: String(url).endsWith("/gone") ? 410 : 201 })
    );
    expect(await queueChanges(env, change, "2027-01-20", now)).toBe(2);
    expect(await drainOutbox(env, 20, fetcher, now)).toBe(1);
    expect(fetcher.mock.calls.map((c) => String(c[0]))).toEqual(["https://fcm.googleapis.com/a", "https://fcm.googleapis.com/gone"]);
    const left = await env.DB.prepare("SELECT endpoint FROM push_subscriptions ORDER BY endpoint").all<{ endpoint: string }>();
    expect(left.results.map((r) => r.endpoint)).toEqual(["https://fcm.googleapis.com/a", "https://fcm.googleapis.com/b"]);
    expect(await drainOutbox(env, 20, fetcher, now)).toBe(0);
  });

  it("sends in portions, never twice, retries failures and drops stale notices", async () => {
    const env = await setup(45);
    let failOnce = true;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/many-3") && failOnce) {
        failOnce = false;
        return new Response(null, { status: 500 });
      }
      return new Response(null, { status: String(url).endsWith("/gone") ? 410 : 201 });
    });
    expect(await queueChanges(env, change, "2027-01-20", now)).toBe(47);
    // Two runs side by side take different notices.
    const [a, b] = await Promise.all([drainOutbox(env, 20, fetcher, now), drainOutbox(env, 20, fetcher, now)]);
    expect(a + b).toBe(38);
    // The rest, and the failed one again (queued anew at the end).
    expect(await drainOutbox(env, 20, fetcher, now)).toBe(8);
    expect(await drainOutbox(env, 20, fetcher, now)).toBe(0);
    const sentTo = fetcher.mock.calls.map((c) => String(c[0]));
    expect(sentTo.filter((u) => u.endsWith("/many-3"))).toHaveLength(2);
    expect(new Set(sentTo).size).toBe(47);

    await queueChanges(env, change, "2027-01-20", now);
    expect(await drainOutbox(env, 100, fetcher, new Date(now.getTime() + 7 * 3600 * 1000))).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM push_outbox").first<{ n: number }>())!.n).toBe(0);
  });
});
