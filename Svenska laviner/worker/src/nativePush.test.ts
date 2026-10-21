/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./auth";
import { fcmBody, resetFcmToken, serviceAccountJwt } from "./fcm";
import { HttpError } from "./http";
import { registerDevice, unregisterDevice, type NativeEnv } from "./nativePush";
import { follow } from "./social";
import { drainOutbox, queueChanges } from "./outbox";
import { migratedD1 } from "./testing/sqliteD1";

let env: NativeEnv;
let publicKey: CryptoKey;
const sent: Array<{ token: string; title: string; url: string }> = [];
let tokenRequests = 0;

const device = (name: string) => `${name}:${"A".repeat(140)}`;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

/** Plays Google: hands out an access token and accepts sends, except to tokens starting with "dead". */
const fakeGoogle: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    tokenRequests++;
    return Response.json({ access_token: "ya29.test", expires_in: 3600 });
  }
  const body = JSON.parse(String(init?.body)) as ReturnType<typeof fcmBody>;
  if (body.message.token.startsWith("dead")) return new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 });
  sent.push({ token: body.message.token, title: body.message.notification.title, url: body.message.data.url });
  return Response.json({ name: "projects/p/messages/1" });
};

function req(path: string, json: unknown, token?: string) {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(json),
  });
}

beforeEach(async () => {
  sent.length = 0;
  tokenRequests = 0;
  resetFcmToken();
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  publicKey = pair.publicKey;
  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  env = {
    DB: migratedD1(),
    FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: "snolage-test", client_email: "push@snolage-test.iam.gserviceaccount.com", private_key: pem }),
  } as unknown as NativeEnv;
  await env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (1, 'a@test', 'Anna', 'x', 1, '2026-01-01'), (2, 'b@test', 'Bertil', 'x', 1, '2026-01-01')").run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, 1, '2026-01-01', '2999-01-01'), (?, 2, '2026-01-01', '2999-01-01')")
    .bind(await sha256("token-anna"), await sha256("token-bertil"))
    .run();
});

afterEach(() => vi.unstubAllGlobals());

describe("native push", () => {
  it("signs a service-account JWT that Google can verify", async () => {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT!);
    const jwt = await serviceAccountJwt(sa, Date.UTC(2026, 9, 7));
    const [h, c, sig] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token" });
    expect(claims.exp - claims.iat).toBe(3600);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(sig, "base64url"), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it("registers areas without an account, and account notices only when signed in", async () => {
    expect(await registerDevice(req("/native/register", { token: device("a1"), platform: "android", regions: ["riksgransfjallen", "påhittad"], account: true }), env)).toEqual({
      regions: ["riksgransfjallen"],
      account: false,
    });
    expect(
      await registerDevice(req("/native/register", { token: device("a1"), platform: "android", regions: [], account: true }, "token-anna"), env)
    ).toEqual({ regions: [], account: true });
    const row = await env.DB.prepare("SELECT user_id, regions FROM native_devices").first<{ user_id: number; regions: string }>();
    expect(row).toEqual({ user_id: 1, regions: "[]" });
    // Nothing wanted any more: the device is forgotten.
    await registerDevice(req("/native/register", { token: device("a1"), platform: "android", regions: [], account: false }, "token-anna"), env);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM native_devices").first<{ n: number }>())!.n).toBe(0);
    await expect(registerDevice(req("/native/register", { token: "kort", platform: "android", regions: ["riksgransfjallen"] }), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("sends danger changes to devices following the area and drops dead tokens", async () => {
    for (const [token, regions] of [
      [device("riks"), ["riksgransfjallen"]],
      [device("jamt"), ["sodra-jamtlandsfjallen"]],
      [`dead${device("x")}`, ["riksgransfjallen"]],
    ] as const) {
      await registerDevice(req("/native/register", { token, platform: "ios", regions }), env);
    }
    const now = new Date("2026-02-18T07:30:00Z");
    expect(await queueChanges(env, [{ regionId: "riksgransfjallen", date: "2026-02-18", from: 2, to: 3 }], "2026-02-18", now)).toBe(2);
    expect(await drainOutbox(env, 20, fakeGoogle, now)).toBe(1);
    expect(sent.map((s) => s.token)).toEqual([device("riks")]);
    expect(sent[0]).toMatchObject({ title: "Riksgränsfjällen: 3 Betydande fara", url: "/omrade/riksgransfjallen" });
    expect(tokenRequests).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM native_devices").first<{ n: number }>())!.n).toBe(2);
  });

  it("sends account notices (e.g. a new follower) to the user's phones only", async () => {
    await registerDevice(req("/native/register", { token: device("bertil"), platform: "android", regions: [], account: true }, "token-bertil"), env);
    await registerDevice(req("/native/register", { token: device("anna"), platform: "android", regions: [], account: true }, "token-anna"), env);
    vi.stubGlobal("fetch", fakeGoogle);
    await follow(new Request("https://worker.test/people/2/follow", { method: "POST", headers: { Authorization: "Bearer token-anna" } }), env, 2);
    expect(sent.map((s) => s.token)).toEqual([device("bertil")]);
    expect(sent[0].url).toBe("/person/1");

  });

  it("stops account notices when the account is deleted, and forgets a device on request", async () => {
    await registerDevice(req("/native/register", { token: device("anna"), platform: "ios", regions: ["kebnekaisefjallen"], account: true }, "token-anna"), env);
    await deleteAccount(new Request("https://worker.test/auth/me", { method: "DELETE", headers: { Authorization: "Bearer token-anna" } }), {
      ...env,
      IMAGES: { delete: async () => {} },
    } as unknown as NativeEnv);
    expect(await env.DB.prepare("SELECT user_id, regions FROM native_devices").first()).toEqual({ user_id: null, regions: '["kebnekaisefjallen"]' });
    await unregisterDevice(req("/native/unregister", { token: device("anna") }), env);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM native_devices").first<{ n: number }>())!.n).toBe(0);
  });

  it("does nothing without the Firebase secret", async () => {
    const off = { ...env, FCM_SERVICE_ACCOUNT: undefined } as NativeEnv;
    await expect(registerDevice(req("/native/register", { token: device("a"), platform: "android", regions: ["riksgransfjallen"] }), off)).rejects.toMatchObject({ status: 503 });
    expect(await queueChanges(off, [{ regionId: "riksgransfjallen", date: "2026-02-18", from: 2, to: 3 }], "2026-02-18")).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
