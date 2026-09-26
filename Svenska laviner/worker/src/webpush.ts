// Web Push without a library: VAPID (RFC 8292) request signing and
// aes128gcm payload encryption (RFC 8291), using only WebCrypto so it runs
// on Cloudflare Workers.

export interface VapidEnv {
  /** Uncompressed P-256 public key, base64url (65 bytes). Given to browsers. */
  VAPID_PUBLIC_KEY?: string;
  /** The matching private scalar d, base64url (32 bytes). Worker secret. */
  VAPID_PRIVATE_KEY?: string;
  /** Contact for push services, e.g. "mailto:someone@example.se". */
  VAPID_SUBJECT?: string;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  /** Browser's P-256 public key, base64url. */
  p256dh: string;
  /** Browser's 16-byte auth secret, base64url. */
  auth: string;
}

export function vapidConfigured(env: VapidEnv): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const text = (s: string) => new TextEncoder().encode(s);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** One record, as RFC 8291 prescribes; payloads here are a few hundred bytes. */
const RECORD_SIZE = 4096;

/**
 * Encrypts `payload` for one browser subscription (Content-Encoding:
 * aes128gcm). `ephemeral` and `salt` are only passed in by tests.
 */
export async function encryptPayload(
  sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  payload: Uint8Array,
  ephemeral?: CryptoKeyPair,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<Uint8Array> {
  const uaPublic = fromBase64Url(sub.p256dh);
  const authSecret = fromBase64Url(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("invalid subscription keys");
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error("payload too large");

  const asKeys =
    ephemeral ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", asKeys.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // The standard field is `public`; workers-types spells it `$public`, so cast.
  const ecdhParams = { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams, asKeys.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdhSecret, concat(text("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 marks the last (only) record; no extra padding.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, new Uint8Array([2])))
  );

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

async function vapidSigningKey(env: VapidEnv): Promise<CryptoKey> {
  const pub = fromBase64Url(env.VAPID_PUBLIC_KEY!);
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(pub.slice(1, 33)),
      y: toBase64Url(pub.slice(33, 65)),
      d: env.VAPID_PRIVATE_KEY!,
      ext: false,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/** The VAPID JWT for one push service origin, valid 12 hours. */
export async function vapidJwt(env: VapidEnv, audience: string, now = Date.now()): Promise<string> {
  const header = toBase64Url(text(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    text(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT }))
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await vapidSigningKey(env),
    text(`${header}.${claims}`)
  );
  return `${header}.${claims}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Browser push services we deliver to; nothing else is ever fetched. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export type SendResult = "sent" | "gone" | "failed";

/** Sends one notification; "gone" means the subscription should be deleted. */
export async function sendPush(
  env: VapidEnv,
  sub: PushSubscriptionKeys,
  message: unknown,
  fetcher: typeof fetch = fetch
): Promise<SendResult> {
  if (!vapidConfigured(env) || !isPushEndpoint(sub.endpoint)) return "failed";
  const body = await encryptPayload(sub, text(JSON.stringify(message)));
  const jwt = await vapidJwt(env, new URL(sub.endpoint).origin);
  try {
    const res = await fetcher(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(12 * 3600),
        Urgency: "normal",
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
