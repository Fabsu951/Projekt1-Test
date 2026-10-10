import { sendEmail, type EmailEnv } from "./email";

// Short emails to the people running Snöläge (users.is_admin with a
// verified address): forecast trouble, the season's first forecasts, new
// reports, backups. Swedish, plain text and simple HTML.

export interface AdminMailEnv extends EmailEnv {
  DB: D1Database;
}

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function adminAddresses(env: AdminMailEnv, except?: number): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT id, email FROM users WHERE is_admin = 1 AND email_verified = 1").all<{ id: number; email: string }>();
  return rows.results.filter((r) => r.id !== except).map((r) => r.email);
}

/** One email per admin; `except` leaves out an admin who caused it themselves. */
export async function mailAdmins(
  env: AdminMailEnv,
  subject: string,
  lines: string[],
  options: { footer?: string[]; except?: number } = {}
): Promise<number> {
  const all = [...lines, "", ...(options.footer ?? []), "/ Snöläge"];
  const text = all.join("\n");
  const html = `<!doctype html><html lang="sv"><body style="font-family:system-ui,sans-serif">${all
    .map((l) => (l ? `<p>${escape(l)}</p>` : ""))
    .join("")}</body></html>`;
  const to = await adminAddresses(env, options.except);
  for (const address of to) await sendEmail(env, { to: address, subject, text, html });
  return to.length;
}
