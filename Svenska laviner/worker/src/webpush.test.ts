/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";
import { encryptPayload, fromBase64Url, isPushEndpoint, sendPush, toBase64Url, vapidJwt } from "./webpush";

async function p256() {
  return (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
}
const raw = async (key: CryptoKey) => new Uint8Array((await crypto.subtle.exportKey("raw", key)) as ArrayBuffer);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const infoBytes = typeof info === "string" ? new TextEncoder().encode(info) : info;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: infoBytes }, key, bytes * 8));
}

/** What a browser does with an aes128gcm push body (RFC 8291), written independently. */
async function browserDecrypt(body: Uint8Array, ua: CryptoKeyPair, authSecret: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idLen = body[20];
  const asPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const params = { name: "ECDH", public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(params, ua.privateKey, 256));
  const uaPublic = await raw(ua.publicKey);
  const info = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, shared, info, 32);
  const cek = await hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
  expect(padded[padded.length - 1]).toBe(2);
  return new TextDecoder().decode(padded.slice(0, -1));
}

async function vapidEnv() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return {
    pair,
    env: {
      VAPID_PUBLIC_KEY: toBase64Url(await raw(pair.publicKey)),
      VAPID_PRIVATE_KEY: jwk.d!,
      VAPID_SUBJECT: "mailto:test@example.se",
    },
  };
}

describe("encryptPayload", () => {
  it("produces a body a browser can decrypt", async () => {
    const ua = await p256();
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const sub = { p256dh: toBase64Url(await raw(ua.publicKey)), auth: toBase64Url(authSecret) };
    const message = JSON.stringify({ title: "Kebnekaisefjällen: 3 Betydande fara", url: "/omrade/kebnekaisefjallen" });

    const body = await encryptPayload(sub, new TextEncoder().encode(message));
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(await browserDecrypt(body, ua, authSecret)).toBe(message);
  });

  it("refuses malformed subscription keys", async () => {
    await expect(encryptPayload({ p256dh: "AAAA", auth: "AAAA" }, new Uint8Array(1))).rejects.toThrow();
  });
});

describe("vapidJwt", () => {
  it("is an ES256 token for the push service origin, verifiable with the public key", async () => {
    const { env, pair } = await vapidEnv();
    const jwt = await vapidJwt(env, "https://fcm.googleapis.com", Date.UTC(2027, 0, 20));
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(h)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(c)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: Date.UTC(2027, 0, 20) / 1000 + 12 * 3600,
      sub: "mailto:test@example.se",
    });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      fromBase64Url(sig),
      new TextEncoder().encode(`${h}.${c}`)
    );
    expect(ok).toBe(true);
  });
});

describe("isPushEndpoint", () => {
  it("only allows the browsers' push services over https", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isPushEndpoint("not a url")).toBe(false);
  });
});

describe("sendPush", () => {
  it("posts an encrypted, VAPID-signed request and reports expired subscriptions", async () => {
    const { env } = await vapidEnv();
    const ua = await p256();
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: toBase64Url(await raw(ua.publicKey)),
      auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
    };
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    expect(await sendPush(env, sub, { title: "x" }, fetcher)).toBe("sent");
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.Authorization).toMatch(new RegExp(`^vapid t=[^,]+, k=${env.VAPID_PUBLIC_KEY}$`));

    expect(await sendPush(env, sub, { title: "x" }, vi.fn(async () => new Response(null, { status: 410 })))).toBe("gone");
    expect(await sendPush({}, sub, { title: "x" }, fetcher)).toBe("failed");
  });
});
