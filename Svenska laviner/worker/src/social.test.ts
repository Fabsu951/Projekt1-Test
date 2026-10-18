/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import type { CommunityEnv } from "./auth";
import { deleteAccount, setLanguage } from "./auth";
import { HttpError } from "./http";
import { addComment, deleteComment, feed, follow, getPerson, listComments, searchPeople, setLike, unfollow } from "./social";
import { createTour, importedSources, listTours, tourLines, tourLinesBody, updateTour } from "./tours";
import { migratedD1 } from "./testing/sqliteD1";
import { experiencePoints, removeAvatar, uploadAvatar } from "./profile";
import { serveImage } from "./observations";
import { listNotifications, markRead, unread } from "./notifications";

let env: CommunityEnv;
let stored: Map<string, Uint8Array>;
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
  stored = new Map();
  const images = {
    put: async (key: string, bytes: Uint8Array) => void stored.set(key, bytes),
    get: async (key: string) => (stored.has(key) ? { body: stored.get(key), httpMetadata: { contentType: "image/jpeg" } } : null),
    delete: async (keys: string | string[]) => [keys].flat().forEach((k) => stored.delete(k)),
  };
  env = { DB: migratedD1(), IMAGES: images } as unknown as CommunityEnv;
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
    await env.DB.prepare("UPDATE users SET display_name = 'Åsa Öberg' WHERE id = 3").run();
    for (const q of ["åsa", "ÅSA", "öBERG", "Sa ö"]) {
      expect((await searchPeople(req(`/people?q=${encodeURIComponent(q)}`, "anna"), env)).people.map((p) => p.displayName)).toEqual([
        "Åsa Öberg",
      ]);
    }
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

  it("builds valid heatmap JSON around the stored previews, whatever the title", async () => {
    const id = await tour(ids.bertil, 'Tur "med" citat \\ och ✓ 🏔️', 1);
    const body = await tourLinesBody(req("/tours/lines"), env);
    expect(JSON.parse(body)).toEqual({
      lines: [{ id, title: 'Tur "med" citat \\ och ✓ 🏔️', startedAt: expect.any(String), points: [[67.9, 18.5], [67.91, 18.5]] }],
    });
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

describe("profile pictures and experience", () => {
  const jpeg = () => {
    const form = new FormData();
    form.set("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: "image/jpeg" }), "a.jpg");
    return form;
  };
  const upload = (who: keyof typeof tokens) =>
    uploadAvatar(
      new Request("https://worker.test/auth/avatar", { method: "POST", headers: { Authorization: `Bearer ${tokens[who]}` }, body: jpeg() }),
      env
    );

  it("counts tours, metres climbed and observations — capped per tour", async () => {
    expect(experiencePoints(2, 1550, 3)).toBe(2 * 20 + 15 + 3 * 30);
    await tour(ids.bertil, "Lång", 1);
    await env.DB.prepare("UPDATE tours SET ascent_m = 9000").run(); // a broken file can't jump levels
    const { person } = await getPerson(req("/people/2", "anna"), env, ids.bertil);
    expect(person).toMatchObject({ tours: 1, ascentM: 3000, observations: 0, xp: 20 + 30, avatarPath: null });
  });

  it("shows everyone who the admins are", async () => {
    await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(ids.bertil).run();
    await tour(ids.bertil, "Admintur", 1);
    expect((await getPerson(req("/people/2", "anna"), env, ids.bertil)).person.isAdmin).toBe(true);
    expect((await getPerson(req("/people/1", "bertil"), env, ids.anna)).person.isAdmin).toBe(false);
    const { items, people } = await feed(req("/feed", "bertil"), env);
    expect(items[0]).toMatchObject({ type: "tour", tour: { authorIsAdmin: true } });
    expect(people[ids.bertil].isAdmin).toBe(true);
  });

  it("stores a picture, replaces the old one, and serves it", async () => {
    const first = await upload("anna");
    expect(first.avatarPath).toMatch(/^\/images\/avatar\/[0-9a-f-]{36}\.jpg$/);
    const second = await upload("anna");
    expect(stored.size).toBe(1); // the first picture is gone
    const res = await serveImage(env, second.avatarPath.slice("/images/".length), {});
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect((await getPerson(req("/people/1"), env, ids.anna)).person.avatarPath).toBe(second.avatarPath);
  });

  it("lets only you, or an admin, remove your picture; and removes it with the account", async () => {
    await upload("bertil");
    expect(await status(removeAvatar(req("/people/2/avatar", "anna", { method: "DELETE" }), env, ids.bertil))).toBe(403);
    await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = 1").run();
    await removeAvatar(req("/people/2/avatar", "anna", { method: "DELETE" }), env, ids.bertil);
    expect(stored.size).toBe(0);

    await upload("cecilia");
    await deleteAccount(req("/auth/me", "cecilia", { method: "DELETE" }), env);
    expect(stored.size).toBe(0);
  });

  it("refuses files that aren't pictures", async () => {
    const form = new FormData();
    form.set("image", new Blob([new TextEncoder().encode("<svg/>")]), "x.svg");
    const r = new Request("https://worker.test/auth/avatar", { method: "POST", headers: { Authorization: `Bearer ${tokens.anna}` }, body: form });
    expect(await status(uploadAvatar(r, env))).toBe(415);
  });
});

describe("notifications", () => {
  const texts = async (who: keyof typeof tokens) =>
    (await listNotifications(req("/notifications", who), env)).notifications.map((n) => n.text);

  it("tells you about new followers, once even if they re-follow", async () => {
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await unfollow(req("/people/2/follow", "anna", { method: "DELETE" }), env, ids.bertil);
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    expect(await texts("bertil")).toEqual(["Anna började följa dig"]);
    expect((await unread(req("/notifications/unread", "bertil"), env)).unread).toBe(1);
    const list = await listNotifications(req("/notifications", "bertil"), env);
    expect(list.notifications[0]).toMatchObject({ url: "/person/1", read: false });
  });

  it("writes them in the reader's language", async () => {
    await setLanguage(req("/auth/lang", "bertil", { json: { lang: "en" } }), env);
    const id = await tour(ids.bertil, "Sydtoppen", 1);
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await addComment(req("/comments", "anna", { json: { type: "tour", id, body: "Fin tur!" } }), env);
    expect(await texts("bertil")).toEqual(["Anna commented on your tour ”Sydtoppen”", "Anna started following you"]);
  });

  it("tells owners about comments and likes, and earlier commenters about replies", async () => {
    const id = await tour(ids.bertil, "Sydtoppen", 1);
    const comment = (who: keyof typeof tokens, body: string) =>
      addComment(req("/comments", who, { json: { type: "tour", id, body } }), env);
    await comment("anna", "Fin tur!");
    await comment("bertil", "Tack!"); // owner answering: Anna hears about it, Bertil doesn't notify himself
    await comment("cecilia", "Hur var snön?");
    await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: true } }), env);
    await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: false } }), env);
    await setLike(req("/likes", "anna", { json: { type: "tour", id, liked: true } }), env); // no second like notice

    expect(await texts("bertil")).toEqual([
      "Anna gillade din tur ”Sydtoppen”",
      "Cecilia kommenterade din tur ”Sydtoppen”",
      "Anna kommenterade din tur ”Sydtoppen”",
    ]);
    expect(await texts("anna")).toEqual(["Cecilia svarade på turen ”Sydtoppen”", "Bertil svarade på turen ”Sydtoppen”"]);
    expect(await texts("cecilia")).toEqual([]);

    await markRead(req("/notifications/read", "bertil", { json: {} }), env);
    expect((await unread(req("/notifications/unread", "bertil"), env)).unread).toBe(0);
  });

  it("forgets notifications with the account that caused them", async () => {
    await follow(req("/people/2/follow", "anna", { method: "POST" }), env, ids.bertil);
    await deleteAccount(req("/auth/me", "anna", { method: "DELETE" }), env);
    expect(await texts("bertil")).toEqual([]);
  });
});

describe("imported tours", () => {
  const points = Array.from({ length: 40 }, (_, i) => [67.9 + i * 0.001, 18.5, 800 + i * 5, Date.UTC(2026, 1, 3, 9, i)]);
  const upload = (sourceRef?: unknown, more: object = {}, track: unknown[] = points) =>
    createTour(
      req("/tours", "anna", {
        json: { title: "Skidtur", description: "", visibility: "private", hideEndsM: 500, points: track, sourceRef, ...more },
      }),
      env
    );

  it("imports a watch session once, even when it is sent again", async () => {
    const first = await upload("hc:abc-123");
    const again = await upload("hc:abc-123");
    expect(again).toMatchObject({ duplicate: true, tour: { id: first.tour.id } });
    expect(await importedSources(req("/tours/sources?prefix=hc", "anna"), env)).toEqual({ refs: ["hc:abc-123"] });
    // Someone else's import of a session with the same id is their own tour.
    expect((await importedSources(req("/tours/sources?prefix=hc", "bertil"), env)).refs).toEqual([]);
    expect(stored.size).toBe(1);
  });

  it("warns about the same outing from another source, unless told to save anyway", async () => {
    const first = await upload("hc:abc-123");
    // The same session as a GPX file a few minutes off: a 409 that names the existing tour.
    const shifted = points.map(([lat, lon, ele, t]) => [lat, lon, ele, (t as number) + 4 * 60_000]);
    let caught: unknown;
    try {
      await upload(undefined, {}, shifted);
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ status: 409, extra: { similarTo: { id: first.tour.id, title: "Skidtur" } } });
    expect((await upload(undefined, { allowDuplicate: true }, shifted)).tour.id).not.toBe(first.tour.id);
    // A different outing the same morning (much longer) is not a duplicate.
    const longer = Array.from({ length: 40 }, (_, i) => [67.9 + i * 0.01, 18.5, 800, Date.UTC(2026, 1, 3, 9, i)]);
    expect((await upload(undefined, {}, longer)).tour).toBeTruthy();
  });

  it("refuses odd source refs and still takes plain uploads", async () => {
    expect(await status(upload("javascript:alert(1) "))).toBe(400);
    expect(await status(upload(42))).toBe(400);
    expect((await upload()).tour.title).toBe("Skidtur");
  });

  it("keeps the warning signs seen on the tour, and 'none seen' apart from 'not answered'", async () => {
    expect((await upload()).tour.dangerSigns).toBeNull();
    const calm = await upload(undefined, { dangerSigns: [], allowDuplicate: true });
    expect(calm.tour.dangerSigns).toEqual([]);
    const changed = await updateTour(
      req(`/tours/${calm.tour.id}`, "anna", { method: "POST", json: { dangerSigns: ["wumpf", "hittepå", "farska_laviner"] } }),
      env,
      calm.tour.id
    );
    expect(changed.tour.dangerSigns).toEqual(["farska_laviner", "wumpf"]);
    const untouched = await updateTour(req(`/tours/${calm.tour.id}`, "anna", { method: "POST", json: { title: "Ny titel" } }), env, calm.tour.id);
    expect(untouched.tour.dangerSigns).toEqual(["farska_laviner", "wumpf"]);
    expect(await status(upload(undefined, { dangerSigns: "wumpf", allowDuplicate: true }))).toBe(400);
  });
});
