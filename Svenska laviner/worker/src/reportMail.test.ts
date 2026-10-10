/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tellAdminsAboutReport } from "./reportMail";
import { migratedD1 } from "./testing/sqliteD1";

let sent: { to: string[]; subject: string; text: string }[] = [];
let env: { DB: D1Database; RESEND_API_KEY: string; EMAIL_FROM: string };
beforeEach(async () => {
  env = { DB: migratedD1(), RESEND_API_KEY: "k", EMAIL_FROM: "Snöläge <noreply@snolage.se>" };
  await env.DB.prepare(
    "INSERT INTO users (id, email, display_name, password_hash, is_admin, email_verified, created_at) VALUES (1, 'admin@test', 'Admin', 'x', 1, 1, '2026-01-01'), (2, 'admin2@test', 'Admin 2', 'x', 1, 1, '2026-01-01'), (3, 'vanlig@test', 'Vanlig', 'x', 0, 1, '2026-01-01')"
  ).run();
  sent = [];
  vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ to: [body.to].flat(), subject: body.subject, text: body.text });
    return new Response("{}");
  });
});
afterEach(() => vi.unstubAllGlobals());

const at = (min: number) => new Date(Date.UTC(2026, 11, 20, 12, min));

describe("emails to admins about reports", () => {
  it("emails at most once per half hour, but always when something was hidden", async () => {
    expect(await tellAdminsAboutReport(env, { type: "comment", hidden: false, reason: "Spam", reporterId: 3 }, at(0))).toBe(true);
    expect(sent.map((m) => m.to).flat().sort()).toEqual(["admin2@test", "admin@test"]);
    expect(sent[0].subject).toBe("Snöläge: ny anmälan av en kommentar");
    expect(sent[0].text).toContain("Skäl: Spam");
    expect(sent[0].text).toContain("/admin");
    const first = sent.length;

    expect(await tellAdminsAboutReport(env, { type: "tour", hidden: false, reason: null, reporterId: 3 }, at(10))).toBe(false);
    expect(sent).toHaveLength(first);

    expect(await tellAdminsAboutReport(env, { type: "observation", hidden: true, reason: null, reporterId: 3 }, at(20))).toBe(true);
    expect(sent.at(-1)!.subject).toBe("Snöläge: en observation har dolts efter anmälningar");

    // The hidden one restarted the quiet period.
    expect(await tellAdminsAboutReport(env, { type: "route", hidden: false, reason: null, reporterId: 3 }, at(45))).toBe(false);
    expect(await tellAdminsAboutReport(env, { type: "route", hidden: false, reason: null, reporterId: 3 }, at(51))).toBe(true);
  });

  it("doesn't email an admin about their own report", async () => {
    await tellAdminsAboutReport(env, { type: "profile", hidden: false, reason: null, reporterId: 1 }, at(0));
    expect(sent.map((m) => m.to).flat()).toEqual(["admin2@test"]);
  });

  it("counts open reports in the email", async () => {
    await env.DB.prepare(
      "INSERT INTO content_reports (item_type, item_id, user_id, reason, created_at) VALUES ('tour', 5, 3, NULL, '2026-12-20'), ('tour', 5, 1, NULL, '2026-12-20'), ('comment', 7, 3, NULL, '2026-12-20')"
    ).run();
    await tellAdminsAboutReport(env, { type: "tour", hidden: false, reason: null, reporterId: 3 }, at(0));
    expect(sent[0].text).toContain("Öppna anmälningar just nu: 2.");
  });
});
