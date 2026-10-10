import { sendEmail, type EmailEnv } from "./email";
import { stockholmDate } from "./model";
import { REGION_SOURCES } from "./regions";

// Watches the forecast fetching itself. After each fetch (cron and cache
// misses) it notes what went wrong; if trouble lasts, the admins get an
// email, again once a day while it lasts, and once more when it works
// again. So a broken API or page in the middle of the season is noticed
// by us rather than by skiers seeing "Ingen prognos".

export interface HealthEnv extends EmailEnv {
  DB: D1Database;
}

/** What the check needs from each area's latest fetch. */
export interface FetchOutcome {
  regionId: string;
  source?: "api" | "page";
  fetchError: string | null;
  danger: number | null;
  seasonOver: boolean;
  special?: string | null;
}

/** Trouble must have lasted this long before anyone is emailed (one bad fetch is not news). */
const GRACE_MS = 30 * 60 * 1000;
/** While it lasts, a reminder at most this often. */
const REMIND_MS = 24 * 3600 * 1000;
const NAME = "forecasts";

const regionName = (id: string) => REGION_SOURCES.find((r) => r.id === id)?.name ?? id;

/** Mid-season: daily forecasts are always published then, so "no level anywhere" is suspicious. */
function midSeason(now: Date): boolean {
  const md = stockholmDate(now).slice(5);
  return md >= "01-10" && md <= "04-10";
}

/** What is wrong with this fetch, one line each (empty when all is well). */
export function forecastProblems(outcomes: FetchOutcome[], now: Date): string[] {
  const problems: string[] = [];
  for (const o of outcomes) {
    if (o.fetchError) problems.push(`${regionName(o.regionId)}: prognosen kunde inte hämtas alls (${o.fetchError}).`);
    else if (o.source === "page")
      problems.push(`${regionName(o.regionId)}: Naturvårdsverkets API svarade inte, prognosen lästes från lavinprognoser.se i stället.`);
  }
  const working = outcomes.filter((o) => !o.fetchError);
  if (midSeason(now) && working.length > 0 && working.every((o) => o.danger === null && !o.special)) {
    problems.push("Mitt i säsongen har inget område någon publicerad farograd. Kontrollera att lavinprognoser.se visar farograder.");
  }
  return problems;
}

interface AlertRow {
  problems: string;
  first_seen: string;
  last_sent: string | null;
}

async function admins(env: HealthEnv): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT email FROM users WHERE is_admin = 1 AND email_verified = 1").all<{ email: string }>();
  return rows.results.map((r) => r.email);
}

async function mail(env: HealthEnv, subject: string, lines: string[]) {
  const text = [...lines, "", "Sidan för hämtningen: https://fjallkoll-worker.fabian-n-sund.workers.dev/forecasts", "/ Snöläge"].join("\n");
  const html = `<!doctype html><html lang="sv"><body style="font-family:system-ui,sans-serif">${lines
    .map((l) => `<p>${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>`)
    .join("")}</body></html>`;
  for (const to of await admins(env)) await sendEmail(env, { to, subject, text, html });
}

/** Records this fetch's health and emails the admins when it's time to. */
export async function checkForecastHealth(env: HealthEnv, outcomes: FetchOutcome[], now = new Date()): Promise<void> {
  const problems = forecastProblems(outcomes, now);
  const row = await env.DB.prepare("SELECT problems, first_seen, last_sent FROM service_alerts WHERE name = ?")
    .bind(NAME)
    .first<AlertRow>();
  const at = now.toISOString();

  if (problems.length === 0) {
    if (!row) return;
    await env.DB.prepare("DELETE FROM service_alerts WHERE name = ?").bind(NAME).run();
    if (row.last_sent) {
      await mail(env, "Snöläge: prognoshämtningen fungerar igen", [
        `Prognoserna hämtas som vanligt igen (problem sedan ${row.first_seen.slice(0, 16).replace("T", " ")} UTC).`,
      ]);
    }
    return;
  }

  const firstSeen = row?.first_seen ?? at;
  const due =
    now.getTime() - Date.parse(firstSeen) >= GRACE_MS &&
    (!row?.last_sent || now.getTime() - Date.parse(row.last_sent) >= REMIND_MS);
  await env.DB.prepare(
    `INSERT INTO service_alerts (name, problems, first_seen, last_sent) VALUES (?, ?, ?, ?)
     ON CONFLICT (name) DO UPDATE SET problems = excluded.problems, last_sent = excluded.last_sent`
  )
    .bind(NAME, JSON.stringify(problems), firstSeen, due ? at : (row?.last_sent ?? null))
    .run();
  if (due) {
    await mail(env, "Snöläge: problem med prognoshämtningen", [
      `Sedan ${firstSeen.slice(0, 16).replace("T", " ")} UTC:`,
      ...problems,
      "Appen visar \"Ingen prognos\" eller den sparade sidan där hämtningen inte fungerar. Du får ett nytt mejl om ett dygn om det håller i sig, och ett när det fungerar igen.",
    ]);
  }
}

/** For the admin overview: what is wrong right now, if anything. */
export async function forecastHealth(db: D1Database): Promise<{ problems: string[]; since: string | null }> {
  const row = await db.prepare("SELECT problems, first_seen FROM service_alerts WHERE name = ?").bind(NAME).first<AlertRow>();
  if (!row) return { problems: [], since: null };
  try {
    return { problems: JSON.parse(row.problems) as string[], since: row.first_seen };
  } catch {
    return { problems: [], since: null };
  }
}
