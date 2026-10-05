import { requireUser, type CommunityEnv } from "./auth";
import { HttpError } from "./http";
import { detectImage } from "./observations";

// Profile pictures and experience points. Experience counts what someone
// has logged and shared — tours, metres climbed, observations — and never
// how steep or risky the skiing was, so the levels don't reward taking
// chances in avalanche terrain.

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** A single tour counts at most this much climbing, so one odd file can't jump levels. */
const MAX_ASCENT_PER_TOUR = 3000;

export const XP = { perTour: 20, per100m: 1, perObservation: 30 } as const;

export interface Badge {
  avatarPath: string | null;
  xp: number;
}

export interface Experience extends Badge {
  tours: number;
  ascentM: number;
  observations: number;
}

export function experiencePoints(tours: number, ascentM: number, observations: number): number {
  return tours * XP.perTour + Math.floor(ascentM / 100) * XP.per100m + observations * XP.perObservation;
}

/** Picture and experience for a set of people, keyed by user id. */
export async function experienceOf(env: CommunityEnv, ids: number[]): Promise<Map<number, Experience>> {
  const unique = [...new Set(ids)];
  const out = new Map<number, Experience>();
  if (unique.length === 0) return out;
  const rows = await env.DB.prepare(
    `SELECT u.id, u.avatar_key,
            (SELECT COUNT(*) FROM tours WHERE user_id = u.id) AS tours,
            (SELECT COALESCE(SUM(MIN(ascent_m, ${MAX_ASCENT_PER_TOUR})), 0) FROM tours WHERE user_id = u.id) AS ascent,
            (SELECT COUNT(*) FROM observations WHERE user_id = u.id AND hidden = 0) AS observations
       FROM users u WHERE u.id IN (${unique.map(() => "?").join(", ")})`
  )
    .bind(...unique)
    .all<{ id: number; avatar_key: string | null; tours: number; ascent: number; observations: number }>();
  for (const r of rows.results) {
    out.set(r.id, {
      avatarPath: r.avatar_key ? `/images/${r.avatar_key}` : null,
      xp: experiencePoints(r.tours, r.ascent, r.observations),
      tours: r.tours,
      ascentM: r.ascent,
      observations: r.observations,
    });
  }
  return out;
}

/** Just picture and points, as an object for JSON responses. */
export async function badgesOf(env: CommunityEnv, ids: number[]): Promise<Record<number, Badge>> {
  const out: Record<number, Badge> = {};
  for (const [id, e] of await experienceOf(env, ids)) out[id] = { avatarPath: e.avatarPath, xp: e.xp };
  return out;
}

async function replaceAvatar(env: CommunityEnv, userId: number, key: string | null) {
  const old = await env.DB.prepare("SELECT avatar_key FROM users WHERE id = ?").bind(userId).first<{ avatar_key: string | null }>();
  await env.DB.prepare("UPDATE users SET avatar_key = ? WHERE id = ?").bind(key, userId).run();
  if (old?.avatar_key) await env.IMAGES.delete(old.avatar_key);
}

/** POST /auth/avatar with the picture as form field "image" (the app crops and re-encodes it first). */
export async function uploadAvatar(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "Skicka bilden som ett formulär.");
  }
  const image = form.get("image");
  if (!image || typeof image === "string" || image.size === 0) throw new HttpError(400, "Välj en bild.");
  if (image.size > MAX_AVATAR_BYTES) throw new HttpError(413, "Bilden är för stor (max 2 MB).");
  const bytes = new Uint8Array(await image.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) throw new HttpError(415, "Bilden måste vara JPEG, PNG eller WebP.");
  const key = `avatar/${crypto.randomUUID()}.${kind.ext}`;
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind.contentType } });
  await replaceAvatar(env, me.id, key);
  return { avatarPath: `/images/${key}` };
}

/** DELETE /auth/avatar (yourself) or /people/:id/avatar (admins, for inappropriate pictures). */
export async function removeAvatar(request: Request, env: CommunityEnv, userId?: number) {
  const me = await requireUser(request, env);
  const target = userId ?? me.id;
  if (target !== me.id && !me.isAdmin) throw new HttpError(403, "Bara admin kan ta bort andras profilbilder.");
  await replaceAvatar(env, target, null);
  return { ok: true };
}

/** For account deletion. */
export async function avatarKeyOf(env: CommunityEnv, userId: number): Promise<string[]> {
  const row = await env.DB.prepare("SELECT avatar_key FROM users WHERE id = ?").bind(userId).first<{ avatar_key: string | null }>();
  return row?.avatar_key ? [row.avatar_key] : [];
}
