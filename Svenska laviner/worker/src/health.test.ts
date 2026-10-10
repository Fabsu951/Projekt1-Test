/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkForecastHealth, forecastHealth, forecastProblems, type FetchOutcome, type HealthEnv } from "./health";
import { migratedD1 } from "./testing/sqliteD1";

const ok = (regionId: string, danger: number | null = 2): FetchOutcome => ({
  regionId,
  source: "api",
  fetchError: null,
  danger,
  seasonOver: false,
});
const allOk = () => [ok("kebnekaisefjallen"), ok("riksgransfjallen")];
const broken = () => [{ ...ok("kebnekaisefjallen"), source: "page" as const }, ok("riksgransfjallen")];

let env: HealthEnv;
let sent: Array<{ to: string; subject: string }>;

beforeEach(async () => {
  env = { DB: migratedD1(), RESEND_API_KEY: "key", EMAIL_FROM: "Snöläge <noreply@snolage.se>" };
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, is_admin, email_verified, created_at) VALUES ('admin@test', 'Admin', 'x', 1, 1, '2026-01-01'), ('vanlig@test', 'Vanlig', 'x', 0, 1, '2026-01-01')"
  ).run();
  sent = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ to: body.to[0], subject: body.subject });
    return new Response("{}", { status: 200 });
  });
});

afterEach(() => vi.unstubAllGlobals());
const at = (iso: string) => new Date(iso);

describe("forecast health check", () => {
  it("names what is wrong", () => {
    const off = at("2026-10-10T07:20:00Z");
    expect(forecastProblems(allOk(), off)).toEqual([]);
    expect(forecastProblems(broken(), off)).toEqual([
      "Kebnekaisefjällen: Naturvårdsverkets API svarade inte, prognosen lästes från lavinprognoser.se i stället.",
    ]);
    expect(forecastProblems([{ ...ok("riksgransfjallen"), fetchError: "HTTP 503" }], off)[0]).toContain("kunde inte hämtas alls (HTTP 503)");
    // No level anywhere is normal off-season, suspicious mid-season.
    const none = [ok("kebnekaisefjallen", null), ok("riksgransfjallen", null)];
    expect(forecastProblems(none, off)).toEqual([]);
    expect(forecastProblems(none, at("2026-02-14T07:20:00Z"))).toHaveLength(1);
  });

  it("emails the admins only when trouble lasts, once a day, and when it is over", async () => {
    await checkForecastHealth(env, broken(), at("2026-02-14T06:20:00Z"));
    expect(sent).toEqual([]);
    await checkForecastHealth(env, broken(), at("2026-02-14T07:20:00Z"));
    expect(sent).toEqual([{ to: "admin@test", subject: "Snöläge: problem med prognoshämtningen" }]);
    await checkForecastHealth(env, broken(), at("2026-02-14T16:20:00Z"));
    expect(sent).toHaveLength(1);
    expect((await forecastHealth(env.DB)).since).toBe("2026-02-14T06:20:00.000Z");
    await checkForecastHealth(env, broken(), at("2026-02-15T07:20:00Z"));
    expect(sent).toHaveLength(2);
    await checkForecastHealth(env, allOk(), at("2026-02-15T16:20:00Z"));
    expect(sent[2]).toEqual({ to: "admin@test", subject: "Snöläge: prognoshämtningen fungerar igen" });
    expect(await forecastHealth(env.DB)).toEqual({ problems: [], since: null });
  });

  it("says nothing about a single bad fetch that fixes itself", async () => {
    await checkForecastHealth(env, broken(), at("2026-02-14T06:20:00Z"));
    await checkForecastHealth(env, allOk(), at("2026-02-14T06:30:00Z"));
    expect(sent).toEqual([]);
  });
});
