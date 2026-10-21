/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { pruneAuth, register, type CommunityEnv } from "./auth";
import { migratedD1 } from "./testing/sqliteD1";

const signup = (json: Record<string, unknown>) =>
  new Request("https://worker.test/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
    body: JSON.stringify({ email: "anna@test.se", password: "ett-langt-losenord", displayName: "Anna", ...json }),
  });

describe("signup and the terms of use", () => {
  it("refuses an account without accepting the terms, and records when they were accepted", async () => {
    const env = { DB: migratedD1() } as unknown as CommunityEnv;
    await expect(register(signup({}), env)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/användarvillkoren/) });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())!.n).toBe(0);

    await register(signup({ acceptTerms: true }), env);
    const row = await env.DB.prepare("SELECT terms_accepted_at FROM users WHERE email = 'anna@test.se'").first<{ terms_accepted_at: string }>();
    expect(row!.terms_accepted_at).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});

describe("pruneAuth", () => {
  it("drops expired sessions and spent email links, keeps the rest", async () => {
    const env = { DB: migratedD1() } as unknown as CommunityEnv;
    await register(signup({ acceptTerms: true }), env);
    const now = new Date("2026-10-21T12:00:00Z");
    const iso = (h: number) => new Date(now.getTime() + h * 3600 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions"),
      env.DB.prepare("DELETE FROM email_tokens"),
      env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('old', 1, ?, ?)").bind(iso(-800), iso(-1)),
      env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('live', 1, ?, ?)").bind(iso(-1), iso(700)),
      env.DB.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at) VALUES ('expired', 1, 'verify', ?, ?)").bind(iso(-30), iso(-6)),
      env.DB.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at, used_at) VALUES ('used', 1, 'reset', ?, ?, ?)").bind(iso(-3), iso(20), iso(-2)),
      env.DB.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at, used_at) VALUES ('just-used', 1, 'reset', ?, ?, ?)").bind(iso(-0.2), iso(20), iso(-0.1)),
      env.DB.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at) VALUES ('open', 1, 'verify', ?, ?)").bind(iso(-2), iso(20)),
    ]);
    await pruneAuth(env, now);
    const sessions = await env.DB.prepare("SELECT token_hash FROM sessions").all<{ token_hash: string }>();
    expect(sessions.results.map((r) => r.token_hash)).toEqual(["live"]);
    const tokens = await env.DB.prepare("SELECT token_hash FROM email_tokens ORDER BY token_hash").all<{ token_hash: string }>();
    expect(tokens.results.map((r) => r.token_hash)).toEqual(["just-used", "open"]);
  });
});
