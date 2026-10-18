/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount, type CommunityEnv } from "./auth";
import { block } from "./blocks";
import { HttpError } from "./http";
import { myShare, pruneShares, sharedWithMe, startShare, stopShare, updatePosition } from "./locationShare";
import { listNotifications } from "./notifications";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;
const people = { anna: 1, bertil: 2, cecilia: 3, david: 4 } as const;
type Who = keyof typeof people;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function req(path: string, who: Who, json?: unknown, method?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer token-${who}` };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`https://worker.test${path}`, {
    method: method ?? (json === undefined ? "GET" : "POST"),
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

async function status(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
}

// Saturday 14 Feb 2026, 09:00 in Sweden.
const morning = new Date(Date.UTC(2026, 1, 14, 8, 0));
const later = (minutes: number) => new Date(morning.getTime() + minutes * 60_000);

const share = (who: Who, viewers: Who[], hours = 3, now = morning) =>
  startShare(req("/location/share", who, { viewerIds: viewers.map((v) => people[v]), hours }), env as never, undefined, now);
const send = (who: Who, lat: number, lon: number, now = later(1)) =>
  updatePosition(req("/location/position", who, { lat, lon, accuracy: 12.4 }), env, now);
const seenBy = async (who: Who, now = later(2)) => (await sharedWithMe(req("/location/shared-with-me", who), env, now)).people;

beforeEach(async () => {
  env = { DB: migratedD1() } as unknown as CommunityEnv;
  for (const [name, id] of Object.entries(people)) {
    await env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (?, ?, ?, 'x', 1, '2026-01-01')"
    )
      .bind(id, `${name}@test`, name[0].toUpperCase() + name.slice(1))
      .run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, '2026-01-01', '2999-01-01')")
      .bind(await sha256(`token-${name}`), id)
      .run();
  }
  // Anna follows Bertil. Anna and Cecilia are on the same tour day today
  // (Cecilia invited Anna, who accepted). Nobody knows David.
  await env.DB.prepare("INSERT INTO follows (follower_id, followee_id, created_at) VALUES (1, 2, '2026-01-01')").run();
  await env.DB.prepare("INSERT INTO trip_plans (id, user_id, region_id, date, created_at) VALUES (10, 3, 'kebnekaisefjallen', '2026-02-14', '2026-02-10')").run();
  await env.DB.prepare("INSERT INTO trip_plans (id, user_id, region_id, date, created_at) VALUES (11, 1, 'kebnekaisefjallen', '2026-02-14', '2026-02-10')").run();
  await env.DB.prepare(
    "INSERT INTO trip_invites (trip_id, from_user, to_user, status, joined_trip_id, created_at) VALUES (10, 3, 1, 'accepted', 11, '2026-02-10')"
  ).run();
});

describe("sharing your position", () => {
  it("offers today's tour company first, then people you follow, never strangers", async () => {
    const { share: current, candidates } = await myShare(req("/location/share", "anna"), env, morning);
    expect(current).toBeNull();
    expect(candidates.map((c) => [c.displayName, c.companion])).toEqual([
      ["Cecilia", true],
      ["Bertil", false],
    ]);
    // The company is only today's: the day after, Cecilia is gone.
    const next = await myShare(req("/location/share", "anna"), env, new Date(Date.UTC(2026, 1, 15, 8)));
    expect(next.candidates.map((c) => c.displayName)).toEqual(["Bertil"]);
  });

  it("shares the latest point with the chosen people only, and tells them", async () => {
    expect(await status(share("anna", ["david"]))).toBe(400); // not someone she knows
    expect(await status(share("anna", ["bertil"], 0))).toBe(400);
    expect(await status(share("anna", ["bertil"], 13))).toBe(400);

    const started = await share("anna", ["bertil", "cecilia", "david"]);
    expect(started.share?.viewers.map((v) => v.displayName)).toEqual(["Bertil", "Cecilia"]);
    expect(started.share?.endsAt).toBe(later(180).toISOString());

    // Nothing to see before the first point arrives.
    expect((await seenBy("bertil"))[0]).toMatchObject({ displayName: "Anna", position: null });
    await send("anna", 67.9001234567, 18.5509876543);
    const seen = await seenBy("bertil");
    expect(seen).toHaveLength(1);
    expect(seen[0].position).toEqual({ lat: 67.900123, lon: 18.550988, accuracy: 12, at: later(1).toISOString() });
    expect(await seenBy("david")).toEqual([]);

    const notes = (await listNotifications(req("/notifications", "bertil"), env)).notifications;
    expect(notes[0]).toMatchObject({ kind: "location_share", url: "/karta?kompisar=1" });
    expect(notes[0].text).toBe("Anna delar sin position med dig till kl. 12:00.");
    expect((await listNotifications(req("/notifications", "david"), env)).notifications).toEqual([]);
  });

  it("keeps only one point and no trail", async () => {
    await share("anna", ["bertil"]);
    await send("anna", 67.9, 18.5, later(1));
    await send("anna", 67.91, 18.52, later(5));
    const rows = await env.DB.prepare("SELECT lat, lon FROM location_shares").all();
    expect(rows.results).toEqual([{ lat: 67.91, lon: 18.52 }]);
  });

  it("ends by itself and deletes the position", async () => {
    await share("anna", ["bertil"], 1);
    await send("anna", 67.9, 18.5);
    expect(await seenBy("bertil", later(59))).toHaveLength(1);
    expect(await seenBy("bertil", later(61))).toEqual([]);
    expect(await status(send("anna", 67.9, 18.5, later(62)))).toBe(404);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM location_shares").first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM location_share_viewers").first<{ n: number }>())?.n).toBe(0);
  });

  it("stops when you say so", async () => {
    await share("anna", ["bertil"]);
    await send("anna", 67.9, 18.5);
    await stopShare(req("/location/share", "anna", undefined, "DELETE"), env);
    expect(await seenBy("bertil")).toEqual([]);
    expect(await status(send("anna", 67.9, 18.5))).toBe(404);
  });

  it("notifies only people newly added when a share changes", async () => {
    await share("anna", ["bertil"]);
    await share("anna", ["bertil", "cecilia"], 4, later(10));
    const bertil = (await listNotifications(req("/notifications", "bertil"), env)).notifications;
    const cecilia = (await listNotifications(req("/notifications", "cecilia"), env)).notifications;
    expect(bertil).toHaveLength(1);
    expect(cecilia).toHaveLength(1);
    expect(cecilia[0].text).toBe("Anna delar sin position med dig till kl. 13:10.");
  });

  it("stops showing it after a block, either way", async () => {
    await share("anna", ["bertil"]);
    await send("anna", 67.9, 18.5);
    await block(req("/people/1/block", "bertil", {}), env, people.anna);
    expect(await seenBy("bertil")).toEqual([]);
    // And Bertil can no longer be chosen.
    expect(await status(share("anna", ["bertil"], 3, later(5)))).toBe(400);
  });

  it("is deleted with the account", async () => {
    await share("anna", ["bertil"]);
    await send("anna", 67.9, 18.5);
    await deleteAccount(req("/auth/account", "anna", {}, "DELETE"), env);
    expect(await seenBy("bertil")).toEqual([]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM location_shares").first<{ n: number }>())?.n).toBe(0);
  });

  it("rejects nonsense positions", async () => {
    await share("anna", ["bertil"]);
    expect(await status(updatePosition(req("/location/position", "anna", { lat: 91, lon: 18 }), env, later(1)))).toBe(400);
    expect(await status(updatePosition(req("/location/position", "anna", { lat: "x", lon: 18 }), env, later(1)))).toBe(400);
  });

  it("prunes ended shares", async () => {
    await share("anna", ["bertil"], 1);
    await pruneShares(env, later(30));
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM location_shares").first<{ n: number }>())?.n).toBe(1);
    await pruneShares(env, later(60));
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM location_shares").first<{ n: number }>())?.n).toBe(0);
  });
});
