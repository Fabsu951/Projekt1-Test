/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";
import { changeFrom, type HistoryRow } from "./history";
import { changeMessage, notifyChanges, type PushEnv } from "./push";
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

describe("notifyChanges", () => {
  it("pushes to subscribers of the changed region only, and deletes gone subscriptions", async () => {
    const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", vapid.privateKey)) as JsonWebKey;
    const vapidPublic = new Uint8Array((await crypto.subtle.exportKey("raw", vapid.publicKey)) as ArrayBuffer);

    const subs = [
      { endpoint: "https://fcm.googleapis.com/a", ...(await subscriptionKeys()), regions: '["kebnekaisefjallen"]' },
      { endpoint: "https://fcm.googleapis.com/b", ...(await subscriptionKeys()), regions: '["riksgransfjallen"]' },
      { endpoint: "https://fcm.googleapis.com/gone", ...(await subscriptionKeys()), regions: '["kebnekaisefjallen"]' },
    ];
    const deleted: unknown[] = [];
    const db = {
      prepare: (sql: string) => ({
        all: async () => ({ results: subs }),
        bind: (...args: unknown[]) => ({ sql, args }),
      }),
      batch: async (stmts: Array<{ args: unknown[] }>) => deleted.push(...stmts.map((s) => s.args[0])),
    };
    const env = {
      DB: db as unknown as D1Database,
      VAPID_PUBLIC_KEY: toBase64Url(vapidPublic),
      VAPID_PRIVATE_KEY: jwk.d!,
      VAPID_SUBJECT: "mailto:test@example.se",
    } satisfies PushEnv;

    const fetcher = vi.fn(async (url: string | URL | Request) =>
      new Response(null, { status: String(url).endsWith("/gone") ? 410 : 201 })
    );
    await notifyChanges(env, [{ regionId: "kebnekaisefjallen", date: "2027-01-21", from: 2, to: 3 }], "2027-01-20", fetcher);

    expect(fetcher.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://fcm.googleapis.com/a",
      "https://fcm.googleapis.com/gone",
    ]);
    expect(deleted).toEqual(["https://fcm.googleapis.com/gone"]);
  });
});
