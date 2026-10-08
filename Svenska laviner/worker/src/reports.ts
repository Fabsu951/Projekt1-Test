import { requirePoster, requireUser, type CommunityEnv, type User } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { notify, type Defer, type NotifyEnv } from "./notifications";
import { d1Store, enforce, record } from "./rateLimit";
import { itemOwner } from "./social";
import { socialCleanup, type ItemType } from "./socialCleanup";

// Reports on tours, shared routes, comments and profiles ("anmäl"), the
// notice-and-action part of the EU Digital Services Act. Observations keep
// their own older system (observations.ts). Comments are hidden after a
// few reports, like observations; tours, routes and profiles wait for an
// admin, who either dismisses the reports or removes the content. The
// owner is then told what was removed and why (a statement of reasons).

export type ReportType = "tour" | "route" | "comment" | "profile";
const REPORT_TYPES: ReportType[] = ["tour", "route", "comment", "profile"];

/** A comment is hidden once this many different people report it. */
export const COMMENT_REPORTS_TO_HIDE = 3;
const REPORT_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };
const MAX_REASON = 500;

/** Reasons the admin picks from when removing something; shown to the owner. */
export const REMOVAL_REASONS: Record<string, string> = {
  olagligt: "innehållet verkar strida mot lag",
  krankande: "innehållet är kränkande, hotfullt eller trakasserande",
  vilseledande: "innehållet är vilseledande eller kan få andra att ta farliga beslut",
  spam: "innehållet är reklam eller spam",
  personuppgifter: "innehållet visar andras personuppgifter",
  ovrigt: "innehållet bryter mot användarvillkoren",
};

function reportType(value: unknown): ReportType {
  if (typeof value === "string" && (REPORT_TYPES as string[]).includes(value)) return value as ReportType;
  throw new HttpError(400, "Det här går inte att anmäla.");
}

function itemId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Ogiltigt inlägg.");
  return id;
}

const notFound = () => new HttpError(404, "Inlägget finns inte.");

/** The owner of a reportable thing the viewer can see (else 404). */
async function ownerOf(env: CommunityEnv, type: ReportType, id: number, viewer: User): Promise<number> {
  if (type === "tour" || type === "route") return itemOwner(env, type, id, viewer);
  if (type === "profile") {
    const row = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(id).first<{ id: number }>();
    if (!row) throw notFound();
    return row.id;
  }
  const row = await env.DB.prepare("SELECT user_id, item_type, item_id, hidden FROM comments WHERE id = ?")
    .bind(id)
    .first<{ user_id: number; item_type: ItemType; item_id: number; hidden: number }>();
  if (!row) throw notFound();
  // Only comments on things the reporter can see.
  await itemOwner(env, row.item_type, row.item_id, viewer);
  return row.user_id;
}

/** POST /reports {type, id, reason} */
export async function reportContent(request: Request, env: CommunityEnv) {
  const me = await requirePoster(request, env);
  const body = await readJson<{ type?: unknown; id?: unknown; reason?: unknown }>(request);
  const type = reportType(body.type);
  const id = itemId(body.id);
  const owner = await ownerOf(env, type, id, me);
  if (owner === me.id) throw new HttpError(400, "Du kan inte anmäla ditt eget innehåll.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) || null : null;

  const store = d1Store(env.DB);
  const key = `report:${me.id}`;
  await enforce(store, [{ key, ...REPORT_LIMIT }], "Du har gjort många anmälningar på kort tid. Vänta en stund.");
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO content_reports (item_type, item_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(type, id, me.id, reason, nowIso())
    .run();
  if (inserted.meta.changes > 0) {
    await record(store, [key]);
    if (type === "comment") {
      const n = await countReports(env, type, id);
      if (n >= COMMENT_REPORTS_TO_HIDE) await env.DB.prepare("UPDATE comments SET hidden = 1 WHERE id = ?").bind(id).run();
    }
  }
  return { ok: true };
}

async function countReports(env: CommunityEnv, type: ReportType, id: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM content_reports WHERE item_type = ? AND item_id = ?")
    .bind(type, id)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

async function requireAdmin(request: Request, env: CommunityEnv): Promise<User> {
  const me = await requireUser(request, env);
  if (!me.isAdmin) throw new HttpError(403, "Endast för administratörer.");
  return me;
}

export interface ReportedItem {
  type: ReportType;
  id: number;
  reports: number;
  latestAt: string;
  /** Up to five reasons people gave, newest first. */
  reasons: string[];
  owner: { id: number; displayName: string };
  /** Title, comment text or display name. */
  summary: string;
  /** Where to look at it in the app. */
  url: string;
  hidden: boolean;
}

interface Described {
  ownerId: number;
  summary: string;
  url: string;
  hidden: boolean;
}

/** What the reported thing is, or null if it has since been deleted. */
async function describeItem(env: CommunityEnv, type: ReportType, id: number): Promise<Described | null> {
  if (type === "tour") {
    const r = await env.DB.prepare("SELECT user_id, title FROM tours WHERE id = ?").bind(id).first<{ user_id: number; title: string }>();
    return r && { ownerId: r.user_id, summary: r.title, url: `/turer/${id}`, hidden: false };
  }
  if (type === "route") {
    const r = await env.DB.prepare("SELECT user_id, title FROM routes WHERE id = ?").bind(id).first<{ user_id: number; title: string }>();
    return r && { ownerId: r.user_id, summary: r.title, url: `/karta?rutt=${id}`, hidden: false };
  }
  if (type === "profile") {
    const r = await env.DB.prepare("SELECT id, display_name FROM users WHERE id = ?").bind(id).first<{ id: number; display_name: string }>();
    return r && { ownerId: r.id, summary: r.display_name, url: `/person/${id}`, hidden: false };
  }
  const r = await env.DB.prepare("SELECT user_id, body, item_type, item_id, hidden FROM comments WHERE id = ?")
    .bind(id)
    .first<{ user_id: number; body: string; item_type: ItemType; item_id: number; hidden: number }>();
  if (!r) return null;
  const url = r.item_type === "tour" ? `/turer/${r.item_id}` : r.item_type === "route" ? `/karta?rutt=${r.item_id}` : "/observationer";
  return { ownerId: r.user_id, summary: r.body.slice(0, 300), url, hidden: r.hidden === 1 };
}

/** GET /admin/content-reports: everything with open reports, most reported first. */
export async function listContentReports(request: Request, env: CommunityEnv) {
  await requireAdmin(request, env);
  const groups = await env.DB.prepare(
    `SELECT item_type, item_id, COUNT(*) AS n, MAX(created_at) AS latest FROM content_reports
      GROUP BY item_type, item_id ORDER BY n DESC, latest DESC LIMIT 200`
  ).all<{ item_type: ReportType; item_id: number; n: number; latest: string }>();
  const items: ReportedItem[] = [];
  for (const g of groups.results) {
    const d = await describeItem(env, g.item_type, g.item_id);
    if (!d) {
      // Deleted since it was reported: nothing left to act on.
      await env.DB.prepare("DELETE FROM content_reports WHERE item_type = ? AND item_id = ?").bind(g.item_type, g.item_id).run();
      continue;
    }
    const reasons = await env.DB.prepare(
      `SELECT reason FROM content_reports WHERE item_type = ? AND item_id = ? AND reason IS NOT NULL
        ORDER BY created_at DESC LIMIT 5`
    )
      .bind(g.item_type, g.item_id)
      .all<{ reason: string }>();
    const owner = await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(d.ownerId).first<{ display_name: string }>();
    items.push({
      type: g.item_type,
      id: g.item_id,
      reports: g.n,
      latestAt: g.latest,
      reasons: reasons.results.map((r) => r.reason),
      owner: { id: d.ownerId, displayName: owner?.display_name ?? "Okänd" },
      summary: d.summary,
      url: d.url,
      hidden: d.hidden,
    });
  }
  return { items, reasons: REMOVAL_REASONS };
}

async function target(request: Request) {
  const body = await readJson<{ type?: unknown; id?: unknown; reason?: unknown; note?: unknown }>(request);
  return { type: reportType(body.type), id: itemId(body.id), reason: body.reason, note: body.note };
}

/** POST /admin/content-reports/dismiss {type, id}: the reports were wrong; shows a hidden comment again. */
export async function dismissContentReports(request: Request, env: CommunityEnv) {
  await requireAdmin(request, env);
  const { type, id } = await target(request);
  const statements = [env.DB.prepare("DELETE FROM content_reports WHERE item_type = ? AND item_id = ?").bind(type, id)];
  if (type === "comment") statements.push(env.DB.prepare("UPDATE comments SET hidden = 0 WHERE id = ?").bind(id));
  await env.DB.batch(statements);
  return { ok: true };
}

/** "din tur ”Sydtoppen”", for the owner's notice. */
function whatWasRemoved(type: ReportType, summary: string): string {
  if (type === "tour") return `Din tur ”${summary}” har tagits bort`;
  if (type === "route") return `Din rutt ”${summary}” har tagits bort`;
  if (type === "comment") return `Din kommentar ”${summary.length > 60 ? `${summary.slice(0, 57)}…` : summary}” har tagits bort`;
  return "Ditt visningsnamn och din profilbild har återställts";
}

/**
 * POST /admin/content-reports/remove {type, id, reason, note?}: removes the
 * content and tells the owner what and why. A profile can't be removed
 * without deleting the account, so its name and picture are reset instead.
 */
export async function removeReportedContent(request: Request, env: NotifyEnv, defer?: Defer) {
  const admin = await requireAdmin(request, env);
  const { type, id, reason, note } = await target(request);
  if (typeof reason !== "string" || !REMOVAL_REASONS[reason]) throw new HttpError(400, "Välj ett skäl.");
  const extra = typeof note === "string" ? note.trim().slice(0, 300) : "";
  const item = await describeItem(env, type, id);
  if (!item) throw notFound();

  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM content_reports WHERE item_type = ? AND item_id = ?").bind(type, id),
  ];
  if (type === "tour") {
    const row = await env.DB.prepare("SELECT track_key FROM tours WHERE id = ?").bind(id).first<{ track_key: string }>();
    if (row?.track_key) await env.IMAGES.delete(row.track_key);
    statements.push(env.DB.prepare("DELETE FROM tours WHERE id = ?").bind(id), ...socialCleanup(env, "tour", id));
  } else if (type === "route") {
    statements.push(env.DB.prepare("DELETE FROM routes WHERE id = ?").bind(id), ...socialCleanup(env, "route", id));
  } else if (type === "comment") {
    statements.push(env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id));
  } else {
    const row = await env.DB.prepare("SELECT avatar_key FROM users WHERE id = ?").bind(id).first<{ avatar_key: string | null }>();
    if (row?.avatar_key) await env.IMAGES.delete(row.avatar_key);
    statements.push(
      env.DB.prepare("UPDATE users SET display_name = ?, avatar_key = NULL WHERE id = ?").bind(`Användare ${id}`, id)
    );
  }
  await env.DB.batch(statements);

  const text =
    `${whatWasRemoved(type, item.summary)} efter en anmälan, eftersom ${REMOVAL_REASONS[reason]}.` +
    (extra ? ` ${extra}` : "") +
    " Tycker du att det är fel, hör av dig till e-postadressen under Om Snöläge.";
  if (item.ownerId !== admin.id) {
    await notify(env, [{ userId: item.ownerId, kind: "moderation", actorId: admin.id, note: text }], defer);
  }
  return { ok: true };
}
