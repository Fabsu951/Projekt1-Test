/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount, type CommunityEnv } from "./auth";
import { HttpError } from "./http";
import { listNotifications } from "./notifications";
import { dismissContentReports, listContentReports, removeReportedContent, reportContent } from "./reports";
import { addComment, getPerson, listComments } from "./social";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;
const people = { anna: 1, bertil: 2, cecilia: 3, dag: 4 } as const;
type Who = keyof typeof people;
const token = (who: Who) => `token-${who}`;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function req(path: string, who?: Who, json?: unknown) {
  const headers: Record<string, string> = {};
  if (who) headers.Authorization = `Bearer ${token(who)}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`https://worker.test${path}`, {
    method: json === undefined ? "GET" : "POST",
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

let clock = 0;
const at = () => new Date(Date.UTC(2026, 3, 1) + ++clock * 60_000).toISOString();

async function tour(userId: number, title: string, shared = 1) {
  const r = await env.DB.prepare(
    `INSERT INTO tours (user_id, title, started_at, distance_m, ascent_m, descent_m, shared, followers_only, track_key, preview, created_at)
     VALUES (?, ?, ?, 1000, 100, 100, ?, 0, ?, '[[67.9,18.5],[67.91,18.5]]', ?)`
  )
    .bind(userId, title, at(), shared, `tracks/${title}.json`, at())
    .run();
  return Number(r.meta.last_row_id);
}

const report = (who: Who, type: string, id: number, reason?: string) =>
  reportContent(req("/reports", who, { type, id, reason }), env);

let deleted: string[];

beforeEach(async () => {
  clock = 0;
  deleted = [];
  const images = { delete: async (keys: string | string[]) => void deleted.push(...[keys].flat()) };
  env = { DB: migratedD1(), IMAGES: images } as unknown as CommunityEnv;
  for (const [name, id] of Object.entries(people)) {
    await env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, email_verified, is_admin, created_at) VALUES (?, ?, ?, 'x', 1, ?, ?)"
    )
      .bind(id, `${name}@test`, name[0].toUpperCase() + name.slice(1), name === "dag" ? 1 : 0, at())
      .run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, '2999-01-01')")
      .bind(await sha256(token(name as Who)), id, at())
      .run();
  }
});

describe("reporting", () => {
  it("reports a shared tour once per person, never your own or one you can't see", async () => {
    const shared = await tour(people.anna, "Sydtoppen");
    const hidden = await tour(people.anna, "Privat", 0);
    await report("bertil", "tour", shared, "Fel plats");
    await report("bertil", "tour", shared, "Igen");
    expect(await status(report("anna", "tour", shared))).toBe(400);
    expect(await status(report("bertil", "tour", hidden))).toBe(404);
    expect(await status(report("bertil", "observation", shared))).toBe(400);
    expect(await status(reportContent(req("/reports", undefined, { type: "tour", id: shared }), env))).toBe(401);
    const { items } = await listContentReports(req("/admin/content-reports", "dag"), env);
    expect(items).toMatchObject([{ type: "tour", id: shared, reports: 1, reasons: ["Fel plats"], summary: "Sydtoppen" }]);
  });

  it("hides a comment after three reports and lets an admin show it again", async () => {
    const t = await tour(people.anna, "Kebne");
    await addComment(req("/comments", "anna", { type: "tour", id: t, body: "Dumt inlägg" }), env);
    const commentId = (await listComments(req(`/comments?type=tour&id=${t}`, "bertil"), env)).comments[0].id;
    for (const who of ["bertil", "cecilia", "dag"] as const) await report(who, "comment", commentId);
    expect((await listComments(req(`/comments?type=tour&id=${t}`, "bertil"), env)).comments).toEqual([]);
    expect((await listComments(req(`/comments?type=tour&id=${t}`, "anna"), env)).comments).toHaveLength(1);

    await dismissContentReports(req("/admin/content-reports/dismiss", "dag", { type: "comment", id: commentId }), env);
    expect((await listComments(req(`/comments?type=tour&id=${t}`, "bertil"), env)).comments).toHaveLength(1);
    expect((await listContentReports(req("/admin/content-reports", "dag"), env)).items).toEqual([]);
  });

  it("is admin-only to list, dismiss and remove", async () => {
    expect(await status(listContentReports(req("/admin/content-reports", "bertil"), env))).toBe(403);
    expect(await status(removeReportedContent(req("/x", "bertil", { type: "tour", id: 1, reason: "spam" }), env as never))).toBe(403);
  });

  it("removes a tour and tells the owner what and why", async () => {
    const t = await tour(people.anna, "Sydtoppen");
    await report("bertil", "tour", t, "Reklam");
    expect(await status(removeReportedContent(req("/x", "dag", { type: "tour", id: t, reason: "påhittat" }), env as never))).toBe(400);
    await removeReportedContent(req("/x", "dag", { type: "tour", id: t, reason: "spam", note: "Länken ledde till en butik." }), env as never);
    expect(await env.DB.prepare("SELECT id FROM tours WHERE id = ?").bind(t).first()).toBeNull();
    expect(deleted).toContain("tracks/Sydtoppen.json");
    const { notifications } = await listNotifications(req("/notifications", "anna"), env);
    expect(notifications[0]).toMatchObject({ kind: "moderation", url: "/om-appen#villkor", actor: { displayName: "Snöläge" } });
    expect(notifications[0].text).toContain("Din tur ”Sydtoppen” har tagits bort efter en anmälan, eftersom innehållet är reklam eller spam.");
    expect(notifications[0].text).toContain("Länken ledde till en butik.");
    expect((await listContentReports(req("/admin/content-reports", "dag"), env)).items).toEqual([]);
  });

  it("resets a reported profile's name and picture instead of deleting it", async () => {
    await env.DB.prepare("UPDATE users SET display_name = 'Elak', avatar_key = 'avatar/x.jpg' WHERE id = ?").bind(people.cecilia).run();
    await report("bertil", "profile", people.cecilia, "Stötande namn");
    await removeReportedContent(req("/x", "dag", { type: "profile", id: people.cecilia, reason: "krankande" }), env as never);
    const seen = await getPerson(req(`/people/${people.cecilia}`, "bertil"), env, people.cecilia);
    expect(seen.person.displayName).toBe(`Användare ${people.cecilia}`);
    expect(deleted).toContain("avatar/x.jpg");
  });

  it("drops reports about things deleted since, and survives account deletion", async () => {
    const t = await tour(people.anna, "Bort");
    await report("bertil", "tour", t);
    await report("bertil", "profile", people.anna);
    await report("anna", "profile", people.cecilia);
    await deleteAccount(req("/auth/account", "anna", {}), env);
    expect((await listContentReports(req("/admin/content-reports", "dag"), env)).items).toEqual([]);
  });
});
