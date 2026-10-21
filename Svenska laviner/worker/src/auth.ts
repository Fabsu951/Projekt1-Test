import { HttpError, readJson, nowIso } from "./http";
import { clear, clientIp, d1Store, enforce, LOGIN_EMAIL_LIMIT, LOGIN_IP_LIMIT, record, REGISTER_IP_LIMIT } from "./rateLimit";
import { verifyTurnstile, type TurnstileEnv } from "./turnstile";
import { trackKeysOf } from "./tours";
import { avatarKeyOf } from "./profile";
import { appUrl, emailConfigured, type EmailEnv, resetEmail, sendEmail, verificationEmail } from "./email";
import { toLang, type Lang } from "./lang";

export interface CommunityEnv extends EmailEnv, TurnstileEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export interface User {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  emailVerified: boolean;
  /**
   * Whether this user may post/report. Requires a verified email once
   * email sending is configured; before that, verification can't happen,
   * so it isn't enforced.
   */
  canPost: boolean;
  /** The language the user reads the app in; notifications and emails follow it. */
  lang: Lang;
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
  email_verified: number;
  password_hash: string;
  lang: string;
}

function toUser(row: UserRow, env: CommunityEnv): User {
  const emailVerified = row.email_verified === 1;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    emailVerified,
    canPost: emailVerified || !emailConfigured(env),
    lang: toLang(row.lang),
  };
}

const USER_COLUMNS = "u.id, u.email, u.display_name, u.is_admin, u.email_verified, u.password_hash, u.lang";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/);
  return match ? match[1] : null;
}

export async function currentUser(request: Request, env: CommunityEnv): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT ${USER_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256(token), nowIso())
    .first<UserRow>();
  return row ? toUser(row, env) : null;
}

export async function requireUser(request: Request, env: CommunityEnv): Promise<User> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "Du behöver logga in.");
  return user;
}

/** For posting and reporting: logged in and (when enforced) email verified. */
export async function requirePoster(request: Request, env: CommunityEnv): Promise<User> {
  const user = await requireUser(request, env);
  if (!user.canPost) throw new HttpError(403, "Bekräfta din e-postadress först — kolla din inkorg.");
  return user;
}

const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;
/** Per user and purpose, to stop the endpoints being used to spam an inbox. */
const MAX_EMAILS_PER_HOUR = 3;

async function createEmailToken(
  env: CommunityEnv,
  userId: number,
  purpose: "verify" | "reset",
  ttlMs: number
): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM email_tokens WHERE user_id = ? AND purpose = ? AND created_at > ?"
  )
    .bind(userId, purpose, hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_EMAILS_PER_HOUR) return null;

  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  await env.DB.prepare(
    "INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(await sha256(token), userId, purpose, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString())
    .run();
  return token;
}

/** Marks a token used and returns its user id, or throws if invalid/expired/used. */
async function consumeEmailToken(env: CommunityEnv, token: string, purpose: "verify" | "reset"): Promise<number> {
  const hash = await sha256(token);
  const now = nowIso();
  const row = await env.DB.prepare(
    "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?"
  )
    .bind(hash, purpose, now)
    .first<{ user_id: number }>();
  if (!row) throw new HttpError(400, "Länken är ogiltig eller har gått ut. Begär en ny.");
  // Conditional update so two simultaneous requests can't both use it.
  const used = await env.DB.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL")
    .bind(now, hash)
    .run();
  if (used.meta.changes === 0) throw new HttpError(400, "Länken är redan använd.");
  return row.user_id;
}

async function sendVerification(env: CommunityEnv, user: { id: number; email: string; displayName: string; lang: Lang }) {
  const token = await createEmailToken(env, user.id, "verify", VERIFY_TTL_MS);
  if (!token) throw new HttpError(429, "Vi har redan skickat flera mejl. Vänta en stund och försök igen.");
  try {
    await sendEmail(env, verificationEmail(user.email, user.displayName, `${appUrl(env)}/verifiera?token=${token}`, user.lang));
  } catch {
    throw new HttpError(502, "Kunde inte skicka mejlet just nu. Försök igen om en stund.");
  }
}

export async function resendVerification(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  if (user.emailVerified) return { ok: true, alreadyVerified: true };
  await sendVerification(env, user);
  return { ok: true };
}

export async function verifyEmail(request: Request, env: CommunityEnv) {
  const { token } = await readJson<{ token?: string }>(request);
  if (!token) throw new HttpError(400, "Länken är ogiltig.");
  const userId = await consumeEmailToken(env, token, "verify");
  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(userId).run();
  return { ok: true };
}

/** Always answers the same way, so it can't be used to find out who has an account. */
export async function forgotPassword(request: Request, env: CommunityEnv) {
  const { email } = await readJson<{ email?: string }>(request);
  const row = await env.DB.prepare("SELECT id, email, display_name, lang FROM users WHERE email = ?")
    .bind((email ?? "").trim().toLowerCase())
    .first<{ id: number; email: string; display_name: string; lang: string }>();
  if (row) {
    const token = await createEmailToken(env, row.id, "reset", RESET_TTL_MS);
    if (token) {
      try {
        await sendEmail(env, resetEmail(row.email, row.display_name, `${appUrl(env)}/aterstall-losenord?token=${token}`, toLang(row.lang)));
      } catch {
        // Don't reveal (via a different error) that this address has an account.
      }
    }
  }
  return { ok: true };
}

export async function resetPassword(request: Request, env: CommunityEnv) {
  const { token, password } = await readJson<{ token?: string; password?: string }>(request);
  if (!password || password.length < MIN_PASSWORD_LENGTH || password.length > 200)
    throw new HttpError(400, `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`);
  if (!token) throw new HttpError(400, "Länken är ogiltig.");
  const userId = await consumeEmailToken(env, token, "reset");
  // A reset link proves control of the inbox, so it also verifies the email.
  // Every existing session is logged out.
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?").bind(
      await hashPassword(password),
      userId
    ),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    env.DB.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(
      nowIso(),
      userId
    ),
  ]);
  const row = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`).bind(userId).first<UserRow>();
  return { token: await createSession(env, userId), user: toUser(row!, env) };
}

interface RegisterBody {
  email?: string;
  password?: string;
  displayName?: string;
  turnstileToken?: string;
  /** Ticked "Jag godkänner användarvillkoren och är minst 13 år". */
  acceptTerms?: boolean;
  /** The app's language when signing up ("sv" or "en"). */
  lang?: string;
}

export async function register(request: Request, env: CommunityEnv) {
  const body = await readJson<RegisterBody>(request);
  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.displayName ?? "").trim();
  const password = body.password ?? "";
  const lang = toLang(body.lang);

  if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, "Ange en giltig e-postadress.");
  if (!DISPLAY_NAME.test(displayName))
    throw new HttpError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, mellanslag, punkt, bindestreck eller understreck.");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200)
    throw new HttpError(400, `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`);
  if (body.acceptTerms !== true) throw new HttpError(400, "Du behöver godkänna användarvillkoren för att skapa ett konto.");

  const store = d1Store(env.DB);
  const registerKey = `register-ip:${clientIp(request)}`;
  await enforce(
    store,
    [{ key: registerKey, ...REGISTER_IP_LIMIT }],
    "Många konton har skapats härifrån den senaste timmen. Försök igen senare."
  );
  await verifyTurnstile(env, body.turnstileToken, clientIp(request));

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
    "INSERT INTO users (email, display_name, password_hash, created_at, terms_accepted_at, lang) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(email, displayName, await hashPassword(password), nowIso(), nowIso(), lang)
    .run();
  const userId = Number(result.meta.last_row_id);
  await record(store, [registerKey]);
  const token = await createSession(env, userId);
  try {
    await sendVerification(env, { id: userId, email, displayName, lang });
  } catch (err) {
    // The account exists either way; the user can resend from their profile.
    console.error("verification email failed", err);
  }
  return {
    token,
    user: {
      id: userId,
      email,
      displayName,
      isAdmin: false,
      emailVerified: false,
      canPost: !emailConfigured(env),
      lang,
    } satisfies User,
  };
}

/** POST /auth/lang {lang}: the app tells which language the user reads it in. */
export async function setLanguage(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const lang = toLang((await readJson<{ lang?: unknown }>(request)).lang);
  if (lang !== user.lang) await env.DB.prepare("UPDATE users SET lang = ? WHERE id = ?").bind(lang, user.id).run();
  return { lang };
}

export async function login(request: Request, env: CommunityEnv) {
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = (body.email ?? "").trim().toLowerCase();
  const store = d1Store(env.DB);
  const emailKey = `login-email:${email}`;
  const ipKey = `login-ip:${clientIp(request)}`;
  await enforce(
    store,
    [
      { key: emailKey, ...LOGIN_EMAIL_LIMIT },
      { key: ipKey, ...LOGIN_IP_LIMIT },
    ],
    "För många misslyckade inloggningsförsök. Vänta en kvart och försök igen, eller återställ lösenordet."
  );

  const row = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.email = ?`)
    .bind(email)
    .first<UserRow>();
  // Same message either way, so the endpoint doesn't reveal which emails have accounts.
  if (!row || !(await verifyPassword(body.password ?? "", row.password_hash))) {
    await record(store, [emailKey, ipKey]);
    throw new HttpError(401, "Fel e-postadress eller lösenord.");
  }
  await clear(store, emailKey);
  return { token: await createSession(env, row.id), user: toUser(row, env) };
}

export async function logout(request: Request, env: CommunityEnv) {
  const token = bearerToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return { ok: true };
}

/**
 * Removes expired sessions and email links nobody can use any more (run by
 * the forecast cron). Links stay an hour past creation at least, since the
 * per-hour email limit counts them.
 */
export async function pruneAuth(env: CommunityEnv, now = new Date()): Promise<void> {
  const at = now.toISOString();
  const hourAgo = new Date(now.getTime() - 3600 * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(at),
    env.DB.prepare("DELETE FROM email_tokens WHERE (expires_at <= ?1 OR used_at IS NOT NULL) AND created_at <= ?2").bind(at, hourAgo),
  ]);
}

/** Deletes the account and everything it posted, including images (GDPR). */
export async function deleteAccount(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  const images = await env.DB.prepare("SELECT image_key FROM observations WHERE user_id = ? AND image_key IS NOT NULL")
    .bind(user.id)
    .all<{ image_key: string }>();
  const keys = [
    ...images.results.map((r) => r.image_key),
    ...(await trackKeysOf(env, user.id)),
    ...(await avatarKeyOf(env, user.id)),
  ];
  // R2 deletes at most 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) await env.IMAGES.delete(keys.slice(i, i + 1000));
  await env.DB.batch([
    // Reports made by the user, and reports about the user or their things.
    env.DB.prepare(
      `DELETE FROM content_reports WHERE user_id = ?1
         OR (item_type = 'profile' AND item_id = ?1)
         OR (item_type = 'tour' AND item_id IN (SELECT id FROM tours WHERE user_id = ?1))
         OR (item_type = 'route' AND item_id IN (SELECT id FROM routes WHERE user_id = ?1))
         OR (item_type = 'comment' AND item_id IN (SELECT id FROM comments WHERE user_id = ?1))`
    ).bind(user.id),
    // Comments and likes on the user's things, then the user's own.
    ...(["tour", "observation", "route"] as const).flatMap((type) => {
      const table = type === "tour" ? "tours" : type === "observation" ? "observations" : "routes";
      return [
        env.DB.prepare(`DELETE FROM comments WHERE item_type = ? AND item_id IN (SELECT id FROM ${table} WHERE user_id = ?)`).bind(type, user.id),
        env.DB.prepare(`DELETE FROM likes WHERE item_type = ? AND item_id IN (SELECT id FROM ${table} WHERE user_id = ?)`).bind(type, user.id),
      ];
    }),
    env.DB.prepare("DELETE FROM comments WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM likes WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM follows WHERE follower_id = ? OR followee_id = ?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM location_share_viewers WHERE user_id = ? OR viewer_id = ?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM location_shares WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM notifications WHERE user_id = ? OR actor_id = ?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM user_push_subscriptions WHERE user_id = ?").bind(user.id),
    // Phones keep their area notices but stop getting the account's.
    env.DB.prepare("UPDATE native_devices SET user_id = NULL WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM reports WHERE user_id = ? OR observation_id IN (SELECT id FROM observations WHERE user_id = ?)").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM observations WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM tours WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM routes WHERE user_id = ?").bind(user.id),
    env.DB.prepare(
      "DELETE FROM trip_invites WHERE from_user = ?1 OR to_user = ?1 OR trip_id IN (SELECT id FROM trip_plans WHERE user_id = ?1)"
    ).bind(user.id),
    env.DB.prepare("UPDATE trip_invites SET joined_trip_id = NULL WHERE joined_trip_id IN (SELECT id FROM trip_plans WHERE user_id = ?)").bind(user.id),
    env.DB.prepare("DELETE FROM trip_plans WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return { ok: true };
}
