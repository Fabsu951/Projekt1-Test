/**
 * Transactional email via Resend (https://resend.com). Sending to arbitrary
 * addresses requires a domain verified in Resend; EMAIL_FROM must use it.
 *
 * When RESEND_API_KEY isn't set (local dev, or before a domain is set up),
 * emails are only logged — visible with `wrangler dev` / `wrangler tail` —
 * and email verification is not enforced (see emailConfigured()).
 */
export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Public site URL used in links, e.g. https://fjallvarning.pages.dev */
  APP_URL?: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function emailConfigured(env: EmailEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function appUrl(env: EmailEnv): string {
  return (env.APP_URL ?? "https://fjallvarning.pages.dev").replace(/\/$/, "");
}

export async function sendEmail(env: EmailEnv, email: Email): Promise<void> {
  if (!emailConfigured(env)) {
    console.log(`[email not configured] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
  });
  if (!res.ok) {
    console.error(`Resend error ${res.status}: ${await res.text()}`);
    throw new Error("email send failed");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(heading: string, intro: string, buttonText: string, link: string, footer: string): Email["html"] {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#10161d;font-family:system-ui,sans-serif;color:#eef3f7">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7cc7ec">Fjällvarning</p>
<h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<p style="line-height:1.5">${escapeHtml(intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#ff9f43;color:#1a1a1a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(buttonText)}</a></p>
<p style="font-size:13px;color:#a2b0be;line-height:1.5">${escapeHtml(footer)}<br>Fungerar inte knappen? Kopiera länken:<br>${escapeHtml(link)}</p>
</div></body></html>`;
}

export function verificationEmail(to: string, displayName: string, link: string): Email {
  const intro = `Hej ${displayName}! Bekräfta din e-postadress för att kunna dela observationer på Fjällvarning.`;
  const footer = "Länken gäller i 24 timmar. Har du inte skapat något konto kan du bortse från det här mejlet.";
  return {
    to,
    subject: "Bekräfta din e-postadress – Fjällvarning",
    text: `${intro}\n\n${link}\n\n${footer}`,
    html: layout("Bekräfta din e-post", intro, "Bekräfta e-postadress", link, footer),
  };
}

export function resetEmail(to: string, displayName: string, link: string): Email {
  const intro = `Hej ${displayName}! Någon (förhoppningsvis du) har bett om att återställa lösenordet till ditt konto.`;
  const footer = "Länken gäller i 1 timme. Har du inte bett om detta kan du bortse från mejlet — ditt lösenord ändras inte.";
  return {
    to,
    subject: "Återställ ditt lösenord – Fjällvarning",
    text: `${intro}\n\n${link}\n\n${footer}`,
    html: layout("Återställ lösenord", intro, "Välj nytt lösenord", link, footer),
  };
}
