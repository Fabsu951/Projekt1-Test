/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { register, type CommunityEnv } from "./auth";
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
