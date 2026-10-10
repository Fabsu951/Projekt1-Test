/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonReportLines, seasonStartReport, type ReportForecast } from "./seasonReport";
import { migratedD1 } from "./testing/sqliteD1";

const base = (regionId: string, more: Partial<ReportForecast> = {}): ReportForecast => ({
  regionId,
  sourceUrl: `https://www.lavinprognoser.se/oversikt-alla-omraden/${regionId}/`,
  source: "api",
  fetchError: null,
  danger: null,
  seasonOver: true,
  notAssessed: false,
  headline: null,
  validUntil: null,
  problems: [],
  ...more,
});
const published = base("kebnekaisefjallen", {
  danger: 3,
  seasonOver: false,
  headline: "Betydande lavinfara på kalfjället",
  validUntil: "2026-12-15T17:00:00.000Z",
  problems: [{ name: "Drevsnöflak", aspects: ["NO", "O"], elevations: ["kalfjall"], metersAbove: null, metersBelow: null, size: "Stora laviner" }],
  trend: { date: "2026-12-16", danger: 2, label: null },
});

let sent: string[] = [];
let env: { DB: D1Database; RESEND_API_KEY: string; EMAIL_FROM: string };
beforeEach(async () => {
  env = { DB: migratedD1(), RESEND_API_KEY: "k", EMAIL_FROM: "Snöläge <noreply@snolage.se>" };
  await env.DB.prepare("INSERT INTO users (email, display_name, password_hash, is_admin, email_verified, created_at) VALUES ('admin@test', 'Admin', 'x', 1, 1, '2026-01-01')").run();
  sent = [];
  vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)).text);
    return new Response("{}");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("the season's first forecasts", () => {
  it("lists what was read for each area, to compare by eye", () => {
    const lines = seasonReportLines([published, base("riksgransfjallen"), base("vastra-vindelfjallen", { fetchError: "HTTP 503", source: "page" })]);
    expect(lines).toContain("Kebnekaisefjällen: 3 Betydande (från API:et)");
    expect(lines).toContain("  Lavinproblem: Drevsnöflak – NO, O; kalfjäll; Stora laviner");
    expect(lines).toContain("  Utveckling 2026-12-16: 2 Måttlig");
    expect(lines).toContain("Riksgränsfjällen: Utanför säsong (från API:et)");
    expect(lines).toContain("Västra Vindelfjällen: kunde inte hämtas (HTTP 503) (från sidan)");
  });

  it("emails the admins once per season, only when a level is published", async () => {
    const dec = new Date("2026-12-14T17:20:00Z");
    expect(await seasonStartReport(env, [base("kebnekaisefjallen")], dec)).toBe(false);
    expect(await seasonStartReport(env, [published], dec)).toBe(true);
    expect(await seasonStartReport(env, [published], new Date("2026-12-15T07:20:00Z"))).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("Jämför med: https://www.lavinprognoser.se/oversikt-alla-omraden/kebnekaisefjallen/");
    // Next season, again.
    expect(await seasonStartReport(env, [published], new Date("2027-12-10T17:20:00Z"))).toBe(true);
  });
});
