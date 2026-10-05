/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import type { CommunityEnv } from "./auth";
import { deleteAccount } from "./auth";
import { HttpError } from "./http";
import { addComment, deleteComment, feed, follow, getPerson, listComments, searchPeople, setLike, unfollow } from "./social";
import { listTours, tourLines } from "./tours";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;
const tokens = { anna: "token-anna", bertil: "token-bertil", cecilia: "token-cecilia" };
const ids = { anna: 1, bertil: 2, cecilia: 3 };

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function req(path: string, who?: keyof typeof tokens, init: { method?: string; json?: unknown } = {}) {
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

async function tour(userId: number, title: string, shared: number, followersOnly = 0) {
  const r = await env.DB.prepare(
    `INSERT INTO tours (user_id, title, started_at, distance_m, ascent_m, descent_m, shared, followers_only, track_key, preview, created_at)
     VALUES (?, ?, ?, 1000, 100, 100, ?, ?, 'k', '[[67.9,18.5],[67.91,18.5]]', ?)`
  )
    .bind(userId, title, at(), shared, followersOnly, at())
    .run();
  return Number(r.meta.last_row_id);
}

beforeEach(async () => {
  clock = 0;
  env = { DB: migratedD1(), IMAGES: { delete: async () => {} } } as unknown as CommunityEnv;
  for (const [name, id] of Object.entries(ids)) {
    await env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (?, ?, ?, 'x', 1, ?)"
    )
      .bind(id, `${name}@test`, name[0].toUpperCase() + name.slice(1), at())
      .run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, '2999-01-01')")
      .bind(await sha256(tokens[name as keyof typeof tokens]), id, at())
      .run();
  }
});

describe("following", () => {
  it("follows and unfollows, with counts both ways", async () => {
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    const seen = await getPerson(req("/people/2", "anna"), env, ids.bertil);
    expect(seen.person).toMatchObject({ followers: 1, following: 0, iFollow: true, followsMe: false });
    const back = await getPerson(req("/people/1", "bertil"), env, ids.anna);
    expect(back.person.followsMe).toBe(true);

    await unfollow(req("/people/2/follow", "anna", { method: "DELETE" }), env, ids.bertil);
    expect((await getPerson(req("/people/2", "anna"), env, ids.bertil)).person.followers).toBe(0);
    expect(await status(follow(req("/people/1/follow", "anna", { method: "POST" }), env, ids.anna))).toBe(400);
  });

  it("finds people by name, never yourself, and treats % and _ literally", async () => {
    const found = await searchPeople(req("/people?q=rti", "anna"), env);
    expect(found.people.map((p) => p.displayName)).toEqual(["Bertil"]);
    expect((await searchPeople(req("/people?q=an", "anna"), env)).people).toEqual([]);
    expect((await searchPeople(req("/people?q=%25%25", "anna"), env)).people).toEqual([]);
    expect(await status(searchPeople(req("/people?q=be"), env))).toBe(401);
  });
});

describe("tour visibility", () => {
  it("shows followers-only tours to followers, never in the public heatmap", async () => {
    await tour(ids.bertil, "Alla ser", 1);
    await tour(ids.bertil, "Bara följare", 1, 1);
    await tour(ids.bertil, "Privat", 0);
    const titles = async (who?: keyof typeof tokens) =>
      (await listTours(req("/tours", who), env)).tours.map((t) => t.title).sort();

    expect(await titles("anna")).toEqual(["Alla ser"]);
    expect(await titles()).toEqual(["Alla ser"]);
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    expect(await titles("anna")).toEqual(["Alla ser", "Bara följare"]);
    expect(await titles("bertil")).toEqual(["Alla ser", "Bara följare"]); // own list views skip private ones
    expect((await tourLines(req("/tours/lines", "anna"), env)).lines.map((l) => l.title)).toEqual(["Alla ser"]);
  });
});

describe("feed", () => {
  it("shows what the people you follow share, and your own, newest first", async () => {
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await tour(ids.bertil, "B publik", 1);
    await tour(ids.bertil, "B följare", 1, 1);
    await tour(ids.bertil, "B privat", 0);
    await tour(ids.cecilia, "C publik", 1);
    await tour(ids.anna, "A egen", 1);
    await env.DB.prepare(
      "INSERT INTO observations (user_id, type, lat, lon, observed_at, created_at, description) VALUES (2, 'lavin', 67.9, 18.5, ?, ?, 'Färsk lavin')"
    )
      .bind(at(), at())
      .run();
    await env.DB.prepare(
      "INSERT INTO routes (user_id, title, waypoints, distance_m, shared, created_at, updated_at) VALUES (2, 'Delad rutt', '[[67.9,18.5],[67.91,18.5]]', 1100, 1, ?, ?)"
    )
      .bind(at(), at())
      .run();
    await env.DB.prepare(
      "INSERT INTO routes (user_id, title, waypoints, distance_m, shared, created_at, updated_at) VALUES (2, 'Privat rutt', '[[67.9,18.5],[67.91,18.5]]', 1100, 0, ?, ?)"
    )
      .bind(at(), at())
      .run();

    const { items, nextBefore } = await feed(req("/feed", "anna"), env);
    const names = items.map((i) =>
      i.type === "tour" ? i.tour.title : i.type === "route" ? i.route.title : i.observation.description
    );
    expect(names).toEqual(["Delad rutt", "Färsk lavin", "A egen", "B följare", "B publik"]);
    expect(items.find((i) => i.type === "tour")!).toMatchObject({ likes: 0, likedByMe: false, comments: 0 });
    expect(nextBefore).toBeNull();
    expect(await status(feed(req("/feed"), env))).toBe(401);
  });
});

describe("comments and likes", () => {
  it("lets people who can see an item comment and like it; owners moderate", async () => {
    const id = await tour(ids.bertil, "Bara följare", 1, 1);
    const comment = (who: keyof typeof tokens, body: string) =>
      addComment(req("/comments", who, { json: { type: "tour", id, body } }), env);

    expect(await status(comment("anna", "Fin tur!"))).toBe(404); // can't see it yet
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    const after = await comment("anna", "Fin tur!");
    expect(after.comments).toHaveLength(1);
    expect(await status(listComments(req(`/comments?type=tour&id=${id}`, "cecilia"), env))).toBe(404);
    expect(await status(comment("anna", "   "))).toBe(400);

    const liked = await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: true } }), env);
    expect(liked).toEqual({ likes: 1, likedByMe: true });
    await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: true } }), env);
    expect((await listComments(req(`/comments?type=tour&id=${id}`, "bertil"), env)).likes).toBe(1);
    expect(await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: false } }), env)).toEqual({ likes: 0, likedByMe: false });

    const commentId = after.comments[0].id;
    expect(after.comments[0].canDelete).toBe(true);
    expect(await status(deleteComment(req(`/comments/${commentId}`, "cecilia", { method: "DELETE" }), env, commentId))).toBe(403);
    await deleteComment(req(`/comments/${commentId}`, "bertil", { method: "DELETE" }), env, commentId); // the tour's owner
    expect((await listComments(req(`/comments?type=tour&id=${id}`, "bertil"), env)).comments).toEqual([]);
  });

  it("removes follows, comments and likes with the account", async () => {
    const id = await tour(ids.bertil, "Publik", 1);
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await addComment(req("/comments", "anna", { json: { type: "tour", id, body: "Hej" } }), env);
    await setLike(req("/likes", "anna", { json: { type: "tour", id } }), env);
    await deleteAccount(req("/auth/me", "anna", { method: "DELETE" }), env);
    for (const table of ["follows", "comments", "likes"]) {
      expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n).toBe(0);
    }
  });
});
