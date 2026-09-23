import { HttpError, readJson, nowIso } from "./http";

export interface CommunityEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export interface User {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

// Cloudflare Workers cap PBKDF2 at 100k iterations.
const PBKDF2_ITERATIONS = 100_000;
const SESSION_DAYS = 90;
const MIN_PASSWORD_LENGTH = 10;
const DISPLAY_NAME = /^[\p{L}\p{N}_ .-]{3,30}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Stored as "pbkdf2$<iterations>$<salt b64>$<hash b64>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
  const candidate = await pbkdf2(password, fromBase64(salt), Number(iterations));
  return timingSafeEqual(candidate, fromBase64(hash));
}

async function sha256(value: string): Promise<string> {
  return toBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function createSession(env: CommunityEnv, userId: number): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(await sha256(token), userId, now.toISOString(), expires.toISOString())
    .run();
  return token;
}

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  is_admin: number;
  password_hash: string;
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, displayName: row.display_name, isAdmin: row.is_admin === 1 };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/);
  return match ? match[1] : null;
}

export async function currentUser(request: Request, env: CommunityEnv): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.is_admin, u.password_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256(token), nowIso())
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function requireUser(request: Request, env: CommunityEnv): Promise<User> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "Du behöver logga in.");
  return user;
}

interface RegisterBody {
  email?: string;
  password?: string;
  displayName?: string;
}

export async function register(request: Request, env: CommunityEnv) {
  const body = await readJson<RegisterBody>(request);
  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.displayName ?? "").trim();
  const password = body.password ?? "";

  if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, "Ange en giltig e-postadress.");
  if (!DISPLAY_NAME.test(displayName))
    throw new HttpError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, mellanslag, punkt, bindestreck eller understreck.");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200)
    throw new HttpError(400, `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`);

  const taken = await env.DB.prepare("SELECT email, display_name FROM users WHERE email = ? OR display_name = ?")
    .bind(email, displayName)
    .first<{ email: string; display_name: string }>();
  if (taken) {
    throw new HttpError(
      409,
      taken.email === email ? "Det finns redan ett konto med den e-postadressen." : "Användarnamnet är upptaget."
    );
  }

  const result = await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(email, displayName, await hashPassword(password), nowIso())
    .run();
  const userId = Number(result.meta.last_row_id);
  const token = await createSession(env, userId);
  return { token, user: { id: userId, email, displayName, isAdmin: false } satisfies User };
}

export async function login(request: Request, env: CommunityEnv) {
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = (body.email ?? "").trim().toLowerCase();
  const row = await env.DB.prepare(
    "SELECT id, email, display_name, is_admin, password_hash FROM users WHERE email = ?"
  )
    .bind(email)
    .first<UserRow>();
  // Same message either way, so the endpoint doesn't reveal which emails have accounts.
  if (!row || !(await verifyPassword(body.password ?? "", row.password_hash))) {
    throw new HttpError(401, "Fel e-postadress eller lösenord.");
  }
  return { token: await createSession(env, row.id), user: toUser(row) };
}

export async function logout(request: Request, env: CommunityEnv) {
  const token = bearerToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return { ok: true };
}

/** Deletes the account and everything it posted, including images (GDPR). */
export async function deleteAccount(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const images = await env.DB.prepare("SELECT image_key FROM observations WHERE user_id = ? AND image_key IS NOT NULL")
    .bind(user.id)
    .all<{ image_key: string }>();
  const keys = images.results.map((r) => r.image_key);
  if (keys.length > 0) await env.IMAGES.delete(keys);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM reports WHERE user_id = ? OR observation_id IN (SELECT id FROM observations WHERE user_id = ?)").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM observations WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return { ok: true };
}
