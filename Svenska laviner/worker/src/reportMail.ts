import { mailAdmins, type AdminMailEnv } from "./adminMail";
import { appUrl } from "./email";

// Tells the admins about reports by email, so nobody has to keep checking
// the admin page: at most one email per half hour, except that something
// hidden automatically (three reports) is always told at once.

const NAME = "report-mail";
const QUIET_MS = 30 * 60 * 1000;

const WHAT: Record<string, string> = {
  observation: "en observation",
  tour: "en tur",
  route: "en rutt",
  comment: "en kommentar",
  profile: "en profil",
};

export interface ReportNews {
  type: keyof typeof WHAT | string;
  /** The item was hidden just now because of its reports. */
  hidden: boolean;
  reason: string | null;
  /** Who reported (an admin isn't emailed about their own report). */
  reporterId: number;
}

async function openReports(db: D1Database): Promise<number> {
  const obs = await db
    .prepare("SELECT COUNT(DISTINCT observation_id) AS n FROM reports")
    .first<{ n: number }>()
    .catch(() => null);
  const content = await db
    .prepare("SELECT COUNT(*) AS n FROM (SELECT DISTINCT item_type, item_id FROM content_reports)")
    .first<{ n: number }>()
    .catch(() => null);
  return (obs?.n ?? 0) + (content?.n ?? 0);
}

/** Returns whether an email went out. */
export async function tellAdminsAboutReport(env: AdminMailEnv, news: ReportNews, now = new Date()): Promise<boolean> {
  const row = await env.DB.prepare("SELECT last_sent FROM service_alerts WHERE name = ?").bind(NAME).first<{ last_sent: string | null }>();
  if (!news.hidden && row?.last_sent && now.getTime() - Date.parse(row.last_sent) < QUIET_MS) return false;
  await env.DB.prepare(
    `INSERT INTO service_alerts (name, problems, first_seen, last_sent) VALUES (?, '[]', ?, ?)
     ON CONFLICT (name) DO UPDATE SET last_sent = excluded.last_sent`
  )
    .bind(NAME, now.toISOString(), now.toISOString())
    .run();
  const what = WHAT[news.type] ?? "ett inlägg";
  const open = await openReports(env.DB);
  const sent = await mailAdmins(
    env,
    news.hidden ? `Snöläge: ${what} har dolts efter anmälningar` : `Snöläge: ny anmälan av ${what}`,
    [
      news.hidden
        ? `${what[0].toUpperCase()}${what.slice(1)} har fått tre anmälningar och döljs nu för andra tills du har granskat det.`
        : `Någon har anmält ${what}.`,
      ...(news.reason ? [`Skäl: ${news.reason}`] : []),
      `Öppna anmälningar just nu: ${open}.`,
      `Granska: ${appUrl(env)}/admin`,
    ],
    { except: news.reporterId, footer: ["Du får högst ett sådant mejl per halvtimme, utom när något döljs automatiskt."] }
  );
  return sent > 0;
}
