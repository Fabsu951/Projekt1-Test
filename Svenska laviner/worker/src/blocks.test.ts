/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import type { CommunityEnv } from "./auth";
import { deleteAccount } from "./auth";
import { HttpError } from "./http";
import { addComment, follow, getPerson, listComments, myBlocks, myFollows, searchPeople, setLike } from "./social";
import { getTour, listTours, tourLines } from "./tours";
import { listObservations } from "./observations";
import { listNotifications } from "./notifications";
import { block, unblock } from "./blocks";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;
const tokens = { anna: "token-anna", bertil: "token-bertil", cecilia: "token-cecilia" };
const ids = { anna: 1, bertil: 2, cecilia: 3 };
type Who = keyof typeof tokens;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function req(path: string, who?: Who, init: { method?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (who) headers.Authorization = `Bearer ${tokens[who]}`;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`https://worker.test${path}`, {
    method: init.method ?? (init.json ? "POST" : "GET"),
    headers,
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
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

let clock = 0;
const at = () => new Date(Date.UTC(2026, 3, 1) + ++clock * 60_000).toISOString();

async function tour(userId: number, title: string) {
  const r = await env.DB.prepare(
    `INSERT INTO tours (user_id, title, started_at, distance_m, ascent_m, descent_m, shared, followers_only, track_key, preview, created_at)
     VALUES (?, ?, ?, 1000, 100, 100, 1, 0, 'k', '[[67.9,18.5],[67.91,18.5]]', ?)`
  )
    .bind(userId, title, at(), at())
    .run();
  return Number(r.meta.last_row_id);
}

async function observation(userId: number, description: string) {
  await env.DB.prepare(
    `INSERT INTO observations (user_id, type, lat, lon, region_id, observed_at, description, created_at)
     VALUES (?, 'ovrigt', 67.9, 18.5, 'kebnekaisefjallen', ?, ?, ?)`
  )
    .bind(userId, at(), description, at())
    .run();
}

const blockReq = (who: Who, id: number) => block(req(`/people/${id}/block`, who, { method: "POST" }), env, id);

beforeEach(async () => {
  clock = 0;
  const images = { put: async () => {}, get: async () => null, delete: async () => {} };
  env = { DB: migratedD1(), IMAGES: images } as unknown as CommunityEnv;
  for (const [name, id] of Object.entries(ids)) {
    await env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (?, ?, ?, 'x', 1, ?)"
    )
      .bind(id, `${name}@test`, name[0].toUpperCase() + name.slice(1), at())
      .run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, '2999-01-01')")
      .bind(await sha256(tokens[name as Who]), id, at())
      .run();
  }
});

describe("blocking", () => {
  it("hides the two from each other's lists and search, both ways", async () => {
    const bertilsTour = await tour(ids.bertil, "Bertils tur");
    await tour(ids.cecilia, "Cecilias tur");
    await observation(ids.bertil, "Bertil såg en lavin");
    await observation(ids.cecilia, "Cecilia såg sprickor");

    await blockReq("anna", ids.bertil);

    const tourTitles = async (who?: Who) => (await listTours(req("/tours", who), env)).tours.map((t) => t.title).sort();
    const obsTexts = async (who?: Who) => (await listObservations(req("/observations", who), env)).observations.map((o) => o.description).sort();
    expect(await tourTitles("anna")).toEqual(["Cecilias tur"]);
    expect(await obsTexts("anna")).toEqual(["Cecilia såg sprickor"]);
    expect((await tourLines(req("/tours/lines", "anna"), env)).lines.map((l) => l.title)).toEqual(["Cecilias tur"]);
    expect(await status(getTour(req(`/tours/${bertilsTour}`, "anna"), env, bertilsTour))).toBe(404);
    expect((await searchPeople(req("/people?q=ber", "anna"), env)).people).toEqual([]);
    // The blocked person doesn't see the one who blocked either.
    expect((await searchPeople(req("/people?q=ann", "bertil"), env)).people).toEqual([]);
    // Others and signed-out visitors still see everything.
    expect(await tourTitles("cecilia")).toEqual(["Bertils tur", "Cecilias tur"]);
    expect(await tourTitles()).toEqual(["Bertils tur", "Cecilias tur"]);
  });

  it("ends following, stops new follows, comments, likes and notices", async () => {
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await follow(req("/people/1/follow", "bertil", { method: "POST" }), env, ids.anna);
    const annasTour = await tour(ids.anna, "Annas tur");
    const cecilias = await tour(ids.cecilia, "Cecilias tur");
    await addComment(req("/comments", "bertil", { json: { type: "tour", id: cecilias, body: "Bertil var här" } }), env);

    await blockReq("anna", ids.bertil);

    expect((await myFollows(req("/people/me/follows", "anna"), env)).following).toEqual([]);
    expect((await myFollows(req("/people/me/follows", "anna"), env)).followers).toEqual([]);
    expect((await listNotifications(req("/notifications", "anna"), env)).notifications).toEqual([]);
    expect(await status(follow(req("/people/1/follow", "bertil", { method: "POST" }), env, ids.anna))).toBe(403);
    expect(await status(follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil))).toBe(403);
    expect(
      await status(addComment(req("/comments", "bertil", { json: { type: "tour", id: annasTour, body: "Hej" } }), env))
    ).toBe(403);
    expect(await status(setLike(req("/likes", "bertil", { json: { type: "tour", id: annasTour } }), env))).toBe(403);
    // On someone else's tour, Bertil's comment is hidden from Anna only.
    expect((await listComments(req(`/comments?type=tour&id=${cecilias}`, "anna"), env)).comments).toEqual([]);
    expect((await listComments(req(`/comments?type=tour&id=${cecilias}`, "cecilia"), env)).comments).toHaveLength(1);
    // Anna commenting on Cecilia's tour doesn't notify Bertil, who commented there before.
    await addComment(req("/comments", "anna", { json: { type: "tour", id: cecilias, body: "Fint" } }), env);
    expect((await listNotifications(req("/notifications", "bertil"), env)).notifications).toEqual([]);
  });

  it("shows who blocked whom on the profile, lists blocks, and only the blocker can lift it", async () => {
    await blockReq("anna", ids.bertil);
    expect((await getPerson(req("/people/2", "anna"), env, ids.bertil)).person).toMatchObject({ blocked: true, blockedByMe: true });
    expect((await getPerson(req("/people/1", "bertil"), env, ids.anna)).person).toMatchObject({ blocked: true, blockedByMe: false });
    expect((await myBlocks(req("/people/me/blocks", "anna"), env)).people.map((p) => p.displayName)).toEqual(["Bertil"]);

    await unblock(req("/people/1/block", "bertil", { method: "DELETE" }), env, ids.anna);
    expect((await getPerson(req("/people/2", "anna"), env, ids.bertil)).person.blocked).toBe(true);
    await unblock(req("/people/2/block", "anna", { method: "DELETE" }), env, ids.bertil);
    expect((await getPerson(req("/people/2", "anna"), env, ids.bertil)).person.blocked).toBe(false);
    expect(await status(follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil))).toBe(200);
    expect(await status(blockReq("anna", ids.anna))).toBe(400);
  });

  it("goes away with the account", async () => {
    await blockReq("anna", ids.bertil);
    await blockReq("cecilia", ids.bertil);
    await deleteAccount(req("/auth/account", "bertil", { method: "DELETE" }), env);
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM blocks").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
