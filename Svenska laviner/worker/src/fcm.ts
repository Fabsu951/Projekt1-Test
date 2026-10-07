// Firebase Cloud Messaging (HTTP v1) for the Android and iOS apps. Firebase
// delivers iPhone messages through Apple's APNs, so the worker only talks to
// Google. Authenticates as a service account: a JWT signed with its RSA key
// (WebCrypto) is exchanged for a one-hour OAuth token.

export interface FcmEnv {
  /** The service account JSON from Firebase (Project settings → Service accounts). Worker secret. */
  FCM_SERVICE_ACCOUNT?: string;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface NativeMessage {
  title: string;
  body: string;
  /** Path in the app to open when the notification is tapped. */
  url: string;
  /** Replaces an earlier notification with the same tag on the device. */
  tag?: string;
}

export type FcmResult = "sent" | "gone" | "failed";

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

export function serviceAccount(env: FcmEnv): ServiceAccount | null {
  if (!env.FCM_SERVICE_ACCOUNT) return null;
  try {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT) as Partial<ServiceAccount>;
    if (sa.project_id && sa.client_email && sa.private_key) return sa as ServiceAccount;
  } catch {
    // Badly pasted secret: treated as not configured.
  }
  return null;
}

export const fcmConfigured = (env: FcmEnv) => serviceAccount(env) !== null;

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlText = (text: string) => b64url(new TextEncoder().encode(text));

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The signed JWT that asks Google for an access token. */
export async function serviceAccountJwt(sa: ServiceAccount, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlText(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri ?? DEFAULT_TOKEN_URI, iat, exp: iat + 3600 })
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`))
  );
  return `${header}.${claims}.${b64url(signature)}`;
}

let cachedToken: { value: string; expires: number; email: string } | null = null;

async function accessToken(sa: ServiceAccount, fetcher: typeof fetch): Promise<string | null> {
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const res = await fetcher(sa.token_uri ?? DEFAULT_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await serviceAccountJwt(sa) }),
  });
  if (!res.ok) {
    console.error("FCM: could not get an access token", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000, email: sa.client_email };
  return data.access_token;
}

/** The FCM v1 request body for one device. */
export function fcmBody(token: string, msg: NativeMessage) {
  return {
    message: {
      token,
      notification: { title: msg.title, body: msg.body },
      data: { url: msg.url },
      android: { priority: "HIGH", notification: { ...(msg.tag ? { tag: msg.tag } : {}), sound: "default" } },
      apns: {
        headers: msg.tag ? { "apns-collapse-id": msg.tag.slice(0, 64) } : {},
        payload: { aps: { sound: "default" } },
      },
    },
  };
}

/** Sends one notification; "gone" means the token is dead and should be forgotten. */
export async function sendFcm(env: FcmEnv, token: string, msg: NativeMessage, fetcher: typeof fetch = fetch): Promise<FcmResult> {
  const sa = serviceAccount(env);
  if (!sa) return "failed";
  try {
    const bearer = await accessToken(sa, fetcher);
    if (!bearer) return "failed";
    const res = await fetcher(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(fcmBody(token, msg)),
    });
    if (res.ok) return "sent";
    const text = await res.text();
    if (res.status === 404 || /UNREGISTERED/.test(text)) return "gone";
    if (res.status === 400 && /registration token/i.test(text)) return "gone";
    console.error("FCM send failed", res.status, text.slice(0, 300));
    return "failed";
  } catch (err) {
    console.error("FCM send failed", err);
    return "failed";
  }
}

/** For tests: forget the cached access token. */
export function resetFcmToken() {
  cachedToken = null;
}
