import { type CommunityEnv, type User, requirePoster, requireUser } from "./auth";
import { HttpError, nowIso } from "./http";
import { REGION_SOURCES } from "./regions";

export const OBSERVATION_TYPES = ["lavin", "sprickor", "kollaps", "glidsprickor", "snotacke", "ovrigt"] as const;
type ObservationType = (typeof OBSERVATION_TYPES)[number];

const MAX_DESCRIPTION = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PER_HOUR = 10;
/** Hidden from the public list once this many different users report it. */
export const REPORTS_TO_HIDE = 3;
const MAX_AGE_DAYS = 30;
// Generous box around the Swedish mountains (and a bit of Norway).
const BOUNDS = { minLat: 55, maxLat: 70, minLon: 10, maxLon: 25 };

interface ObservationRow {
  id: number;
  user_id: number;
  display_name: string;
  type: string;
  lat: number;
  lon: number;
  region_id: string | null;
  observed_at: string;
  created_at: string;
  description: string;
  image_key: string | null;
  hidden: number;
  report_count: number;
}

export interface Observation {
  id: number;
  userId: number;
  author: string;
  type: string;
  lat: number;
  lon: number;
  regionId: string | null;
  observedAt: string;
  createdAt: string;
  description: string;
  /** Path on this worker, e.g. "/images/obs/<uuid>.jpg". */
  imagePath: string | null;
  hidden: boolean;
  reportCount: number;
}

function toObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.display_name,
    type: row.type,
    lat: row.lat,
    lon: row.lon,
    regionId: row.region_id,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    description: row.description,
    imagePath: row.image_key ? `/images/${row.image_key}` : null,
    hidden: row.hidden === 1,
    reportCount: row.report_count,
  };
}

const SELECT = `SELECT o.*, u.display_name FROM observations o JOIN users u ON u.id = o.user_id`;

/** Public feed: newest first, hidden (reported) ones excluded. */
export async function listObservations(request: Request, env: CommunityEnv) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const region = url.searchParams.get("region");
  const mine = url.searchParams.get("mine") === "1";

  const where: string[] = [];
  const binds: unknown[] = [];
  if (mine) {
    const user = await requireUser(request, env);
    where.push("o.user_id = ?");
    binds.push(user.id);
  } else {
    where.push("o.hidden = 0");
  }
  if (region) {
    where.push("o.region_id = ?");
    binds.push(region);
  }

  const rows = await env.DB.prepare(
    `${SELECT} WHERE ${where.join(" AND ")} ORDER BY o.observed_at DESC LIMIT ?`
  )
    .bind(...binds, limit)
    .all<ObservationRow>();
  return { observations: rows.results.map(toObservation) };
}

/** Admin-only: everything that has been reported at least once. */
export async function listReported(request: Request, env: CommunityEnv) {
  const user = await requireUser(request, env);
  if (!user.isAdmin) throw new HttpError(403, "Endast för administratörer.");
  const rows = await env.DB.prepare(
    `${SELECT} WHERE o.report_count > 0 ORDER BY o.report_count DESC, o.created_at DESC LIMIT 200`
  ).all<ObservationRow>();
  return { observations: rows.results.map(toObservation) };
}

function detectImage(bytes: Uint8Array): { ext: string; contentType: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { ext: "png", contentType: "image/png" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { ext: "webp", contentType: "image/webp" };
  return null;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createObservation(request: Request, env: CommunityEnv) {
  const user = await requirePoster(request, env);

  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM observations WHERE user_id = ? AND created_at > ?")
    .bind(user.id, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    throw new HttpError(429, "Du har skickat många observationer den senaste timmen. Försök igen senare.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "Ogiltig förfrågan.");
  }

  const type = field(form, "type") as ObservationType;
  if (!OBSERVATION_TYPES.includes(type)) throw new HttpError(400, "Välj typ av observation.");

  const lat = Number(field(form, "lat"));
  const lon = Number(field(form, "lon"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < BOUNDS.minLat ||
    lat > BOUNDS.maxLat ||
    lon < BOUNDS.minLon ||
    lon > BOUNDS.maxLon
  ) {
    throw new HttpError(400, "Välj en plats i fjällen på kartan.");
  }

  const observedAt = new Date(field(form, "observedAt"));
  const now = Date.now();
  if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > now + 10 * 60 * 1000) {
    throw new HttpError(400, "Ange när du gjorde observationen (inte i framtiden).");
  }
  if (observedAt.getTime() < now - MAX_AGE_DAYS * 24 * 3600 * 1000) {
    throw new HttpError(400, `Observationen får vara högst ${MAX_AGE_DAYS} dagar gammal.`);
  }

  const description = field(form, "description");
  if (description.length < 10 || description.length > MAX_DESCRIPTION) {
    throw new HttpError(400, `Beskriv vad du såg (10–${MAX_DESCRIPTION} tecken).`);
  }

  const regionField = field(form, "regionId");
  const regionId = REGION_SOURCES.some((r) => r.id === regionField) ? regionField : null;

  let imageKey: string | null = null;
  const image = form.get("image");
  if (image && typeof image !== "string" && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) throw new HttpError(413, "Bilden är för stor (max 5 MB).");
    const bytes = new Uint8Array(await image.arrayBuffer());
    const kind = detectImage(bytes);
    if (!kind) throw new HttpError(415, "Bilden måste vara JPEG, PNG eller WebP.");
    imageKey = `obs/${crypto.randomUUID()}.${kind.ext}`;
    await env.IMAGES.put(imageKey, bytes, { httpMetadata: { contentType: kind.contentType } });
  }

  const result = await env.DB.prepare(
    `INSERT INTO observations (user_id, type, lat, lon, region_id, observed_at, created_at, description, image_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(user.id, type, lat, lon, regionId, observedAt.toISOString(), nowIso(), description, imageKey)
    .run();

  const row = await env.DB.prepare(`${SELECT} WHERE o.id = ?`)
    .bind(Number(result.meta.last_row_id))
    .first<ObservationRow>();
  return { observation: toObservation(row!) };
}

async function getRow(env: CommunityEnv, id: number): Promise<ObservationRow> {
  const row = await env.DB.prepare(`${SELECT} WHERE o.id = ?`).bind(id).first<ObservationRow>();
  if (!row) throw new HttpError(404, "Observationen finns inte.");
  return row;
}

export async function reportObservation(request: Request, env: CommunityEnv, id: number) {
  const user = await requirePoster(request, env);
  const row = await getRow(env, id);
  if (row.user_id === user.id) throw new HttpError(400, "Du kan inte anmäla din egen observation.");

  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body.reason?.slice(0, 500) ?? null;
  } catch {
    // Reason is optional.
  }

  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO reports (observation_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(id, user.id, reason, nowIso())
    .run();
  if (inserted.meta.changes > 0) {
    await env.DB.prepare(
      `UPDATE observations SET report_count = report_count + 1,
         hidden = CASE WHEN report_count + 1 >= ? THEN 1 ELSE hidden END
       WHERE id = ?`
    )
      .bind(REPORTS_TO_HIDE, id)
      .run();
  }
  return { ok: true };
}

function canModify(user: User, row: ObservationRow): boolean {
  return user.isAdmin || row.user_id === user.id;
}

export async function deleteObservation(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  const row = await getRow(env, id);
  if (!canModify(user, row)) throw new HttpError(403, "Du kan bara ta bort dina egna observationer.");
  if (row.image_key) await env.IMAGES.delete(row.image_key);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM reports WHERE observation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM observations WHERE id = ?").bind(id),
  ]);
  return { ok: true };
}

/** Admin: un-hide a reported observation and clear its reports. */
export async function restoreObservation(request: Request, env: CommunityEnv, id: number) {
  const user = await requireUser(request, env);
  if (!user.isAdmin) throw new HttpError(403, "Endast för administratörer.");
  await getRow(env, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM reports WHERE observation_id = ?").bind(id),
    env.DB.prepare("UPDATE observations SET hidden = 0, report_count = 0 WHERE id = ?").bind(id),
  ]);
  return { ok: true };
}

export async function serveImage(env: CommunityEnv, key: string, corsHeaders: Record<string, string>) {
  if (!/^obs\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new HttpError(404, "Bilden finns inte.");
  const object = await env.IMAGES.get(key);
  if (!object) throw new HttpError(404, "Bilden finns inte.");
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

