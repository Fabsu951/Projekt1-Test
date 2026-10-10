/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount, type CommunityEnv } from "./auth";
import { HttpError } from "./http";
import { listNotifications } from "./notifications";
import { checkRoute, createTrip, deleteTrip, listTrips, notifyTrips, swedishDay, type PublishedProblem, type SteepPiece } from "./trips";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;
const people = { anna: 1, bertil: 2 } as const;
type Who = keyof typeof people;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function req(path: string, who?: Who, json?: unknown, method?: string) {
  const headers: Record<string, string> = {};
  if (who) headers.Authorization = `Bearer token-${who}`;
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

// Friday 13 Feb 2026, 18:30 in Sweden (17:30 UTC).
const fridayEvening = new Date(Date.UTC(2026, 1, 13, 17, 30));
const saturdayMorning = new Date(Date.UTC(2026, 1, 14, 7, 0));
const plan = (who: Who, regionId: string, date: string, now = fridayEvening) =>
  createTrip(req("/trips", who, { regionId, date }), env, now);
const problem = (type: string, name: string, more: Partial<PublishedProblem> = {}): PublishedProblem => ({
  type,
  name,
  aspects: [],
  elevations: [],
  metersAbove: null,
  metersBelow: null,
  ...more,
});
const texts = async (who: Who) => (await listNotifications(req("/notifications", who), env)).notifications;

beforeEach(async () => {
  env = { DB: migratedD1() } as unknown as CommunityEnv;
  for (const [name, id] of Object.entries(people)) {
    await env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (?, ?, ?, 'x', 1, '2026-01-01')"
    )
      .bind(id, `${name}@test`, name)
      .run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, '2026-01-01', '2999-01-01')")
      .bind(await sha256(`token-${name}`), id)
      .run();
  }
});

describe("planned tours", () => {
  it("names days in Swedish", () => {
    expect(swedishDay("2026-02-14")).toBe("lördag 14 feb");
  });

  it("plans a tour once, only in a known area and within two weeks, and lists your own", async () => {
    const first = await plan("anna", "kebnekaisefjallen", "2026-02-14");
    const again = await plan("anna", "kebnekaisefjallen", "2026-02-14");
    expect(again.trip.id).toBe(first.trip.id);
    expect(await status(plan("anna", "okant", "2026-02-14"))).toBe(400);
    expect(await status(plan("anna", "kebnekaisefjallen", "2026-02-12"))).toBe(400);
    expect(await status(plan("anna", "kebnekaisefjallen", "2026-03-10"))).toBe(400);
    expect(await status(createTrip(req("/trips", undefined, { regionId: "kebnekaisefjallen", date: "2026-02-14" }), env, fridayEvening))).toBe(401);
    expect((await listTrips(req("/trips", "anna"), env, fridayEvening)).trips).toEqual([
      { id: first.trip.id, regionId: "kebnekaisefjallen", date: "2026-02-14", notified: false, routeId: null, routeTitle: null },
    ]);
    expect((await listTrips(req("/trips", "bertil"), env, fridayEvening)).trips).toEqual([]);
    expect(await status(deleteTrip(req(`/trips/${first.trip.id}`, "bertil", undefined, "DELETE"), env, first.trip.id))).toBe(404);
    await deleteTrip(req(`/trips/${first.trip.id}`, "anna", undefined, "DELETE"), env, first.trip.id);
    expect((await listTrips(req("/trips", "anna"), env, fridayEvening)).trips).toEqual([]);
  });

  it("sends the published forecast for the day once, to those who planned that area and day", async () => {
    await plan("anna", "kebnekaisefjallen", "2026-02-14");
    await plan("bertil", "riksgransfjallen", "2026-02-14");
    const published = [{ regionId: "kebnekaisefjallen", date: "2026-02-14", danger: 3, problems: [problem("drevsnoflak", "Drevsnöflak"), problem("nysnoflak", "Nysnöflak")] }];
    await notifyTrips(env as never, published, fridayEvening);
    await notifyTrips(env as never, published, fridayEvening);
    const anna = await texts("anna");
    expect(anna).toHaveLength(1);
    expect(anna[0]).toMatchObject({ kind: "trip", url: "/omrade/kebnekaisefjallen", actor: { displayName: "Snöläge" } });
    expect(anna[0].text).toBe(
      "Prognos för din tur lördag 14 feb i Kebnekaisefjällen: 3 Betydande lavinfara. Lavinproblem: Drevsnöflak, Nysnöflak. Läs hela prognosen innan du går ut."
    );
    expect(await texts("bertil")).toEqual([]);
    expect((await listTrips(req("/trips", "anna"), env, fridayEvening)).trips[0].notified).toBe(true);
  });

  it("says so on the morning of the day if no level was published, never guesses", async () => {
    await plan("bertil", "riksgransfjallen", "2026-02-14");
    await notifyTrips(env as never, [], fridayEvening);
    expect(await texts("bertil")).toEqual([]);
    await notifyTrips(env as never, [], saturdayMorning);
    const [notice] = await texts("bertil");
    expect(notice.text).toContain("har inte publicerat någon farograd för lördag 14 feb i Riksgränsfjällen");
    expect(notice.text).not.toMatch(/\d (Liten|Måttlig|Betydande|Stor)/);
  });

  it("removes old plans after a week and everything with the account", async () => {
    await plan("anna", "kebnekaisefjallen", "2026-02-14");
    await notifyTrips(env as never, [], new Date(Date.UTC(2026, 1, 25, 12)));
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_plans").first<{ n: number }>())?.n).toBe(0);
    await plan("anna", "kebnekaisefjallen", "2026-02-14");
    await deleteAccount(req("/auth/account", "anna", {}), { ...env, IMAGES: { delete: async () => {} } } as never);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM trip_plans").first<{ n: number }>())?.n).toBe(0);
  });

  describe("with a route", () => {
    // NO-facing steep ground at 1200 m (above the treeline) and S-facing at 500 m (below it).
    const steep: SteepPiece[] = [
      [1, 1200, 300],
      [1, 1210, 75],
      [4, 500, 100],
    ];
    const day = (problems: PublishedProblem[]) => ({ regionId: "kebnekaisefjallen", date: "2026-02-14", danger: 3, problems });
    const windSlab = problem("drevsnoflak", "Drevsnöflak", { aspects: ["N", "NO", "O"], elevations: ["kalfjall"] });

    async function saveRoute(who: Who, title: string) {
      const r = await env.DB.prepare(
        "INSERT INTO routes (user_id, title, waypoints, distance_m, created_at, updated_at) VALUES (?, ?, '[]', 1000, '2026-01-01', '2026-01-01')"
      )
        .bind(people[who], title)
        .run();
      return Number(r.meta.last_row_id);
    }

    it("matches steep ground against the problems' aspects and heights", () => {
      expect(checkRoute(steep, day([windSlab]))).toEqual([{ problem: windSlab, metres: 375, sectors: ["NO"] }]);
      // Wrong aspect, or heights given in metres that the ground isn't at: no hit.
      expect(checkRoute(steep, day([problem("x", "X", { aspects: ["S"], elevations: ["kalfjall"] })]))).toEqual([]);
      expect(checkRoute(steep, day([problem("x", "X", { metersAbove: 1400 })]))).toEqual([]);
      // No aspects or heights listed: everywhere.
      expect(checkRoute(steep, day([problem("x", "X")]))[0].metres).toBe(475);
    });

    it("only takes your own routes and well-formed steep data, and can drop the route again", async () => {
      const mine = await saveRoute("anna", "Sydtoppen");
      const theirs = await saveRoute("bertil", "Hemlig");
      const body = (extra: object) => ({ regionId: "kebnekaisefjallen", date: "2026-02-14", ...extra });
      expect(await status(createTrip(req("/trips", "anna", body({ routeId: theirs, steep })), env, fridayEvening))).toBe(400);
      expect(await status(createTrip(req("/trips", "anna", body({ routeId: mine, steep: [[9, 1, 1]] })), env, fridayEvening))).toBe(400);
      const planned = await createTrip(req("/trips", "anna", body({ routeId: mine, steep })), env, fridayEvening);
      expect(planned.trip).toMatchObject({ routeId: mine, routeTitle: "Sydtoppen" });
      // Planning the same day without a route keeps it; null removes it.
      expect((await plan("anna", "kebnekaisefjallen", "2026-02-14")).trip.routeId).toBe(mine);
      const dropped = await createTrip(req("/trips", "anna", body({ routeId: null })), env, fridayEvening);
      expect(dropped.trip).toMatchObject({ id: planned.trip.id, routeId: null });
    });

    it("says in the notice where the route meets the problems, without calling anything safe", async () => {
      const mine = await saveRoute("anna", "Sydtoppen");
      await createTrip(req("/trips", "anna", { regionId: "kebnekaisefjallen", date: "2026-02-14", routeId: mine, steep }), env, fridayEvening);
      await notifyTrips(env as never, [day([windSlab, problem("vata-laviner", "Våta laviner", { aspects: ["V"] })])], fridayEvening);
      const [notice] = await texts("anna");
      expect(notice.text).toContain("Din rutt ”Sydtoppen” går över brant mark (över 30°) där prognosen anger: Drevsnöflak ca 400 m (NO).");
      expect(notice.text).not.toContain("Våta laviner ca");
      expect(notice.text).not.toMatch(/säker\b(?! –)/);
    });

    it("writes the notice in English for English readers", async () => {
      await env.DB.prepare("UPDATE users SET lang = 'en' WHERE id = ?").bind(people.anna).run();
      const mine = await saveRoute("anna", "South top");
      await createTrip(req("/trips", "anna", { regionId: "kebnekaisefjallen", date: "2026-02-14", routeId: mine, steep }), env, fridayEvening);
      await notifyTrips(env as never, [day([windSlab])], fridayEvening);
      const [notice] = await texts("anna");
      expect(notice.text).toBe(
        "Forecast for your tour Saturday 14 Feb in Kebnekaisefjällen: 3 Considerable avalanche danger. Avalanche problems: Wind slab. " +
          "Your route ”South top” crosses steep ground (over 30°) where the forecast places: Wind slab about 400 m (NE). " +
          "Check the route in the map before you go. Read the whole forecast before you go out."
      );
    });
  });

  it("adds SMHI's warnings for the day to the notice", async () => {
    await plan("anna", "kebnekaisefjallen", "2026-02-14");
    const wind = {
      id: "1-1",
      level: "yellow" as const,
      event: { sv: "Mycket hård vind", en: "Very strong wind" },
      area: { sv: "Fjällen", en: "The mountains" },
      start: "2026-02-13T18:00:00.000Z",
      end: "2026-02-15T06:00:00.000Z",
      text: { sv: "", en: "" },
    };
    await notifyTrips(
      env as never,
      [{ regionId: "kebnekaisefjallen", date: "2026-02-14", danger: 2, problems: [] }],
      fridayEvening,
      undefined,
      async () => ({ kebnekaisefjallen: [wind] })
    );
    const [notice] = await texts("anna");
    expect(notice.text).toMatch(/Läs hela prognosen innan du går ut\. SMHI varnar: Gul varning – Mycket hård vind\.$/);
  });
});
