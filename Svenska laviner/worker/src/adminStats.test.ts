/// <reference types="node" />
import { describe, expect, it } from "vitest";
import type { CommunityEnv } from "./auth";
import { HttpError } from "./http";
import { adminStats, mondayOf, weekly } from "./adminStats";
import { migratedD1 } from "./testing/sqliteD1";

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

describe("admin overview", () => {
  it("buckets by Swedish week, Monday first", () => {
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    const weeks = weekly(
      { users: ["2026-10-04T22:30:00Z", "2026-10-06T10:00:00Z"], observations: ["2025-01-01T00:00:00Z"], tours: [] },
      new Date("2026-10-08T12:00:00Z")
    );
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toEqual({ week: "2026-10-05", users: 2, observations: 0, tours: 0 });
    expect(weeks.reduce((n, w) => n + w.observations, 0)).toBe(0);
  });

  it("counts for admins only", async () => {
    const env = { DB: migratedD1() } as unknown as CommunityEnv;
    const now = new Date();
    for (const [id, admin, favorites] of [[1, 1, '["kebnekaisefjallen"]'], [2, 0, '["kebnekaisefjallen","riksgransfjallen"]']] as const) {
      await env.DB.prepare(
        "INSERT INTO users (id, email, display_name, password_hash, email_verified, is_admin, favorites, created_at) VALUES (?, ?, ?, 'x', 1, ?, ?, ?)"
      )
        .bind(id, `u${id}@test`, `U${id}`, admin, favorites, now.toISOString())
        .run();
      await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, '2999-01-01')")
        .bind(await sha256(`tok${id}`), id, now.toISOString())
        .run();
    }
    await env.DB.prepare(
      "INSERT INTO observations (user_id, type, lat, lon, region_id, observed_at, created_at, description) VALUES (2, 'lavin', 67.9, 18.5, 'kebnekaisefjallen', ?, ?, 'Färsk lavin i nordost.')"
    )
      .bind(now.toISOString(), now.toISOString())
      .run();
    const req = (tok: string) => new Request("https://w.test/admin/stats", { headers: { Authorization: `Bearer ${tok}` } });
    await expect(adminStats(req("tok2"), env)).rejects.toBeInstanceOf(HttpError);
    const stats = await adminStats(req("tok1"), env, now);
    expect(stats.totals).toMatchObject({ users: 2, verifiedUsers: 2, activeLastWeek: 2, observations: 1 });
    expect(stats.weeks.at(-1)).toMatchObject({ users: 2, observations: 1 });
    expect(stats.regions.find((r) => r.regionId === "kebnekaisefjallen")).toMatchObject({ favorites: 2, observations: 1, tours: 0 });
  });
});
