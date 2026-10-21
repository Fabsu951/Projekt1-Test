/**
 * Transactional email via Resend (https://resend.com). Sending to arbitrary
 * addresses requires a domain verified in Resend; EMAIL_FROM must use it.
 *
 * When RESEND_API_KEY isn't set (local dev, or before a domain is set up),
 * emails are only logged — visible with `wrangler dev` / `wrangler tail` —
 * and email verification is not enforced (see emailConfigured()).
 */
import type { Lang } from "./lang";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Public site URL used in links, e.g. https://snolage.se */
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
  return (env.APP_URL ?? "https://snolage.se").replace(/\/$/, "");
}

export async function sendEmail(env: EmailEnv, email: Email): Promise<void> {
  if (!emailConfigured(env)) {
    console.log(`[email not configured] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    signal: AbortSignal.timeout(10_000),
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

function layout(heading: string, intro: string, buttonText: string, link: string, footer: string, lang: Lang): Email["html"] {
  const copy = lang === "en" ? "Button not working? Copy the link:" : "Fungerar inte knappen? Kopiera länken:";
  // The app's paper-map look (light, ink text, lake-blue button); no all-caps, no orange.
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f7f6;font-family:system-ui,sans-serif;color:#17222b">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;font-size:17px;color:#1c5d99;margin:0 0 20px">Snöläge</p>
<h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<p style="line-height:1.5">${escapeHtml(intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#1c5d99;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(buttonText)}</a></p>
<p style="font-size:13px;color:#4f5d68;line-height:1.5;border-top:1px solid #cdbba3;padding-top:16px">${escapeHtml(footer)}<br>${copy}<br>${escapeHtml(link)}</p>
</div></body></html>`;
}

const TEXTS = {
  verify: {
    sv: {
      subject: "Bekräfta din e-postadress – Snöläge",
      intro: (name: string) => `Hej ${name}! Bekräfta din e-postadress för att kunna dela observationer på Snöläge.`,
      footer: "Länken gäller i 24 timmar. Har du inte skapat något konto kan du bortse från det här mejlet.",
      heading: "Bekräfta din e-post",
      button: "Bekräfta e-postadress",
    },
    en: {
      subject: "Confirm your email address – Snöläge",
      intro: (name: string) => `Hi ${name}! Confirm your email address to be able to share observations on Snöläge.`,
      footer: "The link is valid for 24 hours. If you didn't create an account, you can ignore this email.",
      heading: "Confirm your email",
      button: "Confirm email address",
    },
  },
  reset: {
    sv: {
      subject: "Återställ ditt lösenord – Snöläge",
      intro: (name: string) => `Hej ${name}! Någon (förhoppningsvis du) har bett om att återställa lösenordet till ditt konto.`,
      footer: "Länken gäller i 1 timme. Har du inte bett om detta kan du bortse från mejlet — ditt lösenord ändras inte.",
      heading: "Återställ lösenord",
      button: "Välj nytt lösenord",
    },
    en: {
      subject: "Reset your password – Snöläge",
      intro: (name: string) => `Hi ${name}! Someone (hopefully you) asked to reset the password for your account.`,
      footer: "The link is valid for 1 hour. If you didn't ask for this, you can ignore the email — your password won't change.",
      heading: "Reset password",
      button: "Choose a new password",
    },
  },
};

function compose(kind: keyof typeof TEXTS, to: string, displayName: string, link: string, lang: Lang): Email {
  const t = TEXTS[kind][lang];
  const intro = t.intro(displayName);
  return {
    to,
    subject: t.subject,
    text: `${intro}\n\n${link}\n\n${t.footer}`,
    html: layout(t.heading, intro, t.button, link, t.footer, lang),
  };
}

export function verificationEmail(to: string, displayName: string, link: string, lang: Lang = "sv"): Email {
  return compose("verify", to, displayName, link, lang);
}

export function resetEmail(to: string, displayName: string, link: string, lang: Lang = "sv"): Email {
  return compose("reset", to, displayName, link, lang);
}
