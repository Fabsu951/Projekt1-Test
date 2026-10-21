import { fcmConfigured, sendFcm, type FcmEnv, type NativeMessage } from "./fcm";
import { changeMessage, type DangerChange, type PushEnv } from "./push";
import { toLang } from "./lang";
import { sendPush, vapidConfigured } from "./webpush";

// Danger-level notices to every browser and phone following an area. A
// worker run may make only 50 outgoing requests on Cloudflare's free plan
// (and has little CPU time), so sending them all from the forecast run
// would silently stop after a few dozen. Instead they are queued in
// push_outbox and sent DRAIN_BATCH at a time, each portion in a run of its
// own: the worker calls itself through the SELF service binding. What is
// left after that (very many subscribers) goes out with the quarter-hourly
// cron.

export type OutboxEnv = PushEnv & FcmEnv & { SELF?: Fetcher };

/** Notices per run; each is one outgoing request (plus Google's sign-in for phones). */
export const DRAIN_BATCH = 20;
/** Runs started at once, so DRAIN_BATCH × MAX_PARALLEL notices per round. */
const MAX_PARALLEL = 20;
const MAX_TRIES = 3;
/** A notice about today's level that is hours late only confuses; drop it. */
const MAX_AGE_MS = 6 * 3600 * 1000;
export const DRAIN_PATH = "/internal/push-drain";

type Channel = "web" | "native";

interface OutboxRow {
  id: number;
  channel: Channel;
  target: string;
  message: string;
  tries: number;
  created_at: string;
}

function follows(regionsJson: string, regionId: string): boolean {
  try {
    const regions: unknown = JSON.parse(regionsJson);
    return Array.isArray(regions) && regions.includes(regionId);
  } catch {
    return false;
  }
}

/** Queues one notice per follower and change. Returns how many. */
export async function queueChanges(env: OutboxEnv, changes: DangerChange[], today: string, now = new Date()): Promise<number> {
  if (changes.length === 0) return 0;
  const rows: Array<[Channel, string, string]> = [];
  const add = (channel: Channel, target: string, regions: string, lang: string) => {
    for (const change of changes) {
      if (follows(regions, change.regionId)) rows.push([channel, target, JSON.stringify(changeMessage(change, today, toLang(lang)))]);
    }
  };
  if (vapidConfigured(env)) {
    const subs = await env.DB.prepare("SELECT endpoint, regions, lang FROM push_subscriptions").all<{ endpoint: string; regions: string; lang: string }>();
    for (const s of subs.results) add("web", s.endpoint, s.regions, s.lang);
  }
  if (fcmConfigured(env)) {
    const devices = await env.DB.prepare("SELECT token, regions, lang FROM native_devices WHERE regions != '[]'").all<{
      token: string;
      regions: string;
      lang: string;
    }>();
    for (const d of devices.results) add("native", d.token, d.regions, d.lang);
  }
  const at = now.toISOString();
  for (let i = 0; i < rows.length; i += 50) {
    await env.DB.batch(
      rows
        .slice(i, i + 50)
        .map(([channel, target, message]) =>
          env.DB.prepare("INSERT INTO push_outbox (channel, target, message, created_at) VALUES (?, ?, ?, ?)").bind(channel, target, message, at)
        )
    );
  }
  return rows.length;
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

/**
 * Sends up to `max` queued notices. Each is claimed (deleted) before it is
 * sent, so runs side by side never send the same one twice; a failed send
 * is queued again, at most MAX_TRIES times. Returns how many went out.
 */
export async function drainOutbox(env: OutboxEnv, max = DRAIN_BATCH, fetcher: typeof fetch = fetch, now = new Date()): Promise<number> {
  const claimed = await env.DB.prepare(
    "DELETE FROM push_outbox WHERE id IN (SELECT id FROM push_outbox ORDER BY id LIMIT ?) RETURNING id, channel, target, message, tries, created_at"
  )
    .bind(max)
    .all<OutboxRow>();
  const rows = claimed.results.filter((r) => now.getTime() - Date.parse(r.created_at) <= MAX_AGE_MS);
  if (rows.length === 0) return 0;

  // Only browsers and phones that still follow anything (one may have been dropped as gone meanwhile).
  const endpoints = [...new Set(rows.filter((r) => r.channel === "web").map((r) => r.target))];
  const keys = new Map<string, { p256dh: string; auth: string }>();
  if (endpoints.length) {
    const res = await env.DB.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint IN (${placeholders(endpoints.length)})`)
      .bind(...endpoints)
      .all<{ endpoint: string; p256dh: string; auth: string }>();
    for (const r of res.results) keys.set(r.endpoint, r);
  }
  const tokens = [...new Set(rows.filter((r) => r.channel === "native").map((r) => r.target))];
  const devices = new Set<string>();
  if (tokens.length) {
    const res = await env.DB.prepare(`SELECT token FROM native_devices WHERE token IN (${placeholders(tokens.length)})`)
      .bind(...tokens)
      .all<{ token: string }>();
    for (const r of res.results) devices.add(r.token);
  }

  let sent = 0;
  const gone = { web: new Set<string>(), native: new Set<string>() };
  const retry: OutboxRow[] = [];
  for (const row of rows) {
    if (gone[row.channel].has(row.target)) continue;
    let result: "sent" | "gone" | "failed";
    if (row.channel === "web") {
      const k = keys.get(row.target);
      if (!k) continue;
      result = await sendPush(env, { endpoint: row.target, ...k }, JSON.parse(row.message), fetcher);
    } else {
      if (!devices.has(row.target)) continue;
      result = await sendFcm(env, row.target, JSON.parse(row.message) as NativeMessage, fetcher);
    }
    if (result === "sent") sent++;
    else if (result === "gone") gone[row.channel].add(row.target);
    else if (row.tries + 1 < MAX_TRIES) retry.push(row);
  }

  const statements = [
    ...[...gone.web].map((e) => env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(e)),
    ...[...gone.native].map((t) => env.DB.prepare("DELETE FROM native_devices WHERE token = ?").bind(t)),
    ...retry.map((r) =>
      env.DB.prepare("INSERT INTO push_outbox (channel, target, message, tries, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        r.channel,
        r.target,
        r.message,
        r.tries + 1,
        r.created_at
      )
    ),
  ];
  if (statements.length) await env.DB.batch(statements);
  return sent;
}

/** Marks the worker's calls to itself, so the drain path isn't open to everyone. */
export async function drainKey(env: OutboxEnv): Promise<string> {
  const secret = `${env.VAPID_PRIVATE_KEY ?? ""}|${env.FCM_SERVICE_ACCOUNT ?? ""}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`push-drain:${secret}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sends what is queued: in runs of their own through the SELF binding when
 * there is one (each with its own request and CPU limits), else one portion
 * here.
 */
export async function sendQueued(env: OutboxEnv, fetcher: typeof fetch = fetch): Promise<void> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_outbox").first<{ n: number }>();
  const left = row?.n ?? 0;
  if (left === 0) return;
  if (!env.SELF) {
    await drainOutbox(env, DRAIN_BATCH, fetcher);
    return;
  }
  const key = await drainKey(env);
  const runs = Math.min(MAX_PARALLEL, Math.ceil(left / DRAIN_BATCH));
  await Promise.all(
    Array.from({ length: runs }, () =>
      env
        .SELF!.fetch(`https://worker.internal${DRAIN_PATH}`, { method: "POST", headers: { "X-Drain-Key": key } })
        .then((res) => res.body?.cancel())
        .catch((err) => console.error("Could not start a push run", err))
    )
  );
}
