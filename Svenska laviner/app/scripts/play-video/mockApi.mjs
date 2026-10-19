// Sample answers for the demo video (a copy of the browser tests' mock API).
// Made-up people and data only.
export const API = "http://demo.invalid";
const now = Date.now();
const iso = (h) => new Date(now + h * 3600e3).toISOString();
const smhi = { timeSeries: Array.from({ length: 30 }, (_, i) => ({ time: iso(i), data: { air_temperature: -5 + i * 0.2, wind_speed: 4 + (i % 8), wind_from_direction: 250, wind_speed_of_gust: 9 + (i % 8), symbol_code: 3, precipitation_amount_mean: 0.2 } })) };
const forecasts = { regions: ["kebnekaisefjallen", "riksgransfjallen", "vastra-vindelfjallen", "sodra-lapplandsfjallen", "sodra-jamtlandsfjallen", "vastra-harjedalsfjallen"].map((id, i) => ({
  regionId: id, sourceUrl: "https://www.lavinprognoser.se/x", fetchError: null, danger: i === 0 ? 3 : null, seasonOver: i > 1, notAssessed: i === 1,
  headline: i === 0 ? "Betydande lavinfara på kalfjället" : null, publishedText: "5 oktober 2026, 08:00", mainMessage: i === 0 ? "Drevsnö har lagt sig i läsluttningar." : null,
  problems: i === 0 ? [{ type: "drevsnoflak", name: "Drevsnöflak", aspects: ["NO", "O"], elevations: ["kalfjall"], metersAbove: null, metersBelow: null, sensitivity: "Lätt att utlösa", size: "Storlek 2", where: "Läsidor", infoUrl: null }] : [],
})) };
const user = { id: 1, email: "demo@example.se", displayName: "Demo", isAdmin: false, emailVerified: true, canPost: true, avatarPath: null, xp: 1040 };
const tour = { id: 5, userId: 2, author: "Bertil", title: "Kebnekaise sydtoppen", description: "Fint.", startedAt: iso(-200), durationS: 30000, distanceM: 19800, ascentM: 1500, descentM: 1500, maxElevationM: 2096, regionId: "kebnekaisefjallen", shared: true, visibility: "public", hideEndsM: 500, pin: [67.88, 18.55], createdAt: iso(-199) };
const obs = { id: 8, userId: 2, author: "Bertil", type: "lavin", lat: 67.9, lon: 18.5, regionId: "kebnekaisefjallen", observedAt: iso(-5), createdAt: iso(-4), description: "Färsk lavin i nordostsluttning, storlek 2.", imagePath: null, hidden: false, reportCount: 0, dangerSigns: ["farska_laviner"], snowDepthCm: 120 };
const route = { id: 3, title: "Plan", waypoints: [[67.85, 18.6], [67.9, 18.52]], distanceM: 6600, ascentM: 900, descentM: 0, regionId: "kebnekaisefjallen", shared: true, mine: true, createdAt: iso(-3), updatedAt: iso(-3) };
const person = { id: 2, displayName: "Bertil", followers: 3, following: 2, iFollow: true, followsMe: false, isMe: false, avatarPath: null, xp: 420, tours: 9, ascentM: 9000, observations: 3 };
export const OVERRIDES = {};
export function respond(url, method) {
  { const u0 = new URL(url); if (url.startsWith(API) && OVERRIDES[u0.pathname]) return OVERRIDES[u0.pathname](u0, method); }
  const u = new URL(url);
  const p = u.pathname;
  if (url.startsWith(API) && method && method !== "GET") {
    const today = new Date(now).toISOString().slice(0, 10);
    if (/^\/people\/\d+\/follow$/.test(p)) return { json: { person: { ...person, iFollow: method === "POST" } } };
    if (method === "DELETE") return { json: {} };
    if (p === "/trips") return { json: { trip: { id: 99, regionId: "kebnekaisefjallen", date: today, notified: false, routeId: null, routeTitle: null, invites: [], company: [] } } };
    if (/^\/trips\/\d+\/invites$/.test(p)) return { json: { invites: [] } };
    if (p.startsWith("/trips/invitations/")) return { json: { accepted: true, tripId: 99 } };
    if (p === "/comments") return { json: { comments: [], likes: 0, likedByMe: false, people: {} } };
    if (p === "/likes") return { json: { likes: 1, likedByMe: true } };
    if (/^\/people\/\d+\/follow$/.test(p)) return { json: { person } };
    if (p === "/observations") return { json: { observation: obs } };
    if (p === "/tours" || /^\/tours\/\d+$/.test(p)) return { json: { tour } };
    if (p === "/routes" || /^\/routes\/\d+$/.test(p)) return { json: { route } };
    if (p === "/auth/avatar") return { json: { avatarPath: null } };
    return { json: {} };
  }
  if (u.host.includes("metobs") && p.endsWith("/parameter/8.json")) return { json: { station: [{ id: 1, name: "Storlien-Storvallen", latitude: 63.28, longitude: 12.12, height: 583, active: true }, { id: 2, name: "Ånn", latitude: 63.32, longitude: 12.55, height: 528, active: true }] } };
  if (u.host.includes("metobs") && p.includes("/parameter/8/")) { const v = []; for (let d = 6; d >= 0; d--) v.push({ date: now - d * 864e5, value: String(0.4 + (6 - d) * 0.03) }); return { json: { value: v } }; }
  if (u.host.includes("smhi")) return u.host.includes("metfcst") ? { json: smhi } : { status: 404 };
  if (u.host.includes("mapterhorn")) return { status: 404 };
  if (!url.startsWith(API)) return null;
  if (p === "/forecasts") return { json: forecasts };
  if (p.startsWith("/forecasts/history")) return { json: { days: Array.from({ length: 7 }, (_, i) => ({ date: new Date(now - (6 - i) * 864e5).toISOString().slice(0, 10), danger: i > 3 ? 3 : null, problems: [] })) } };
  if (p === "/auth/me") return { json: { user: { ...user, lang: globalThis.LANG ?? "sv" } } };
  if (p === "/auth/lang") return { json: { lang: globalThis.LANG ?? "sv" } };
  if (p === "/auth/favorites") return { json: { favorites: ["kebnekaisefjallen"] } };
  if (p === "/push/key") return { json: { key: null } };
  if (p === "/observations" || p === "/observations/mine" || p.startsWith("/observations")) return { json: { observations: [obs] } };
  if (p === "/tours/lines") return { json: { lines: [{ id: 5, title: "x", startedAt: iso(-200), points: [[67.86, 18.58], [67.9, 18.52]] }] } };
  if (p === "/tours") return { json: { tours: [tour] } };
  if (p.startsWith("/tours/")) return { json: { tour, track: [[67.86, 18.58, 700, null], [67.88, 18.55, 1400, null], [67.9, 18.52, 2000, null]] } };
  if (p === "/routes") return { json: { routes: [route] } };
  if (p.startsWith("/routes/")) return { json: { route } };
  if (p === "/feed") return { json: { items: [{ type: "tour", id: 5, createdAt: iso(-1), tour, line: [[67.86, 18.58], [67.9, 18.52]], likes: 1, likedByMe: false, comments: 0 }, { type: "observation", id: 8, createdAt: iso(-2), observation: obs, likes: 0, likedByMe: false, comments: 1 }], people: { 2: { avatarPath: null, xp: 420 } }, nextBefore: null } };
  if (p === "/people/me/blocks") return { json: { people: [] } };
  if (p === "/people/me/follows") return { json: { following: [{ id: 2, displayName: "Bertil", iFollow: true, avatarPath: null, xp: 420 }], followers: [] } };
  if (p.startsWith("/people/1")) return { json: { person: { ...person, id: 1, displayName: "Demo", isMe: true } } };
  if (p.startsWith("/people/")) return { json: { person } };
  if (p === "/people") return { json: { people: [] } };
  if (p === "/comments") return { json: { comments: [], likes: 0, likedByMe: false, people: {} } };
  if (p === "/admin/stats") return { json: { totals: { users: 42, verifiedUsers: 40, activeLastWeek: 12, observations: 7, hiddenObservations: 1, tours: 9, sharedTours: 6, routes: 3, comments: 5, follows: 8, tripPlans: 2, webPush: 4, appDevices: 1, openReports: 2 }, weeks: Array.from({ length: 12 }, (_, i) => ({ week: new Date(Date.UTC(2026, 6, 20 + i * 7)).toISOString().slice(0, 10), users: [1,0,2,3,1,4,2,6,5,3,8,7][i], observations: [0,0,0,1,0,0,2,1,0,1,1,1][i], tours: [3,2,1,0,1,0,0,1,0,2,1,1][i] })), regions: [{ regionId: "kebnekaisefjallen", name: "Kebnekaisefjällen", favorites: 30, observations: 5, tours: 4 }, { regionId: "riksgransfjallen", name: "Riksgränsfjällen", favorites: 22, observations: 1, tours: 3 }] } };
  if (p === "/admin/content-reports") return { json: { items: [{ type: "comment", id: 4, reports: 3, latestAt: iso(-1), reasons: ["Elakt"], owner: { id: 2, displayName: "Bertil" }, summary: "Dumt sagt", url: "/turer/5", hidden: true }, { type: "profile", id: 2, reports: 1, latestAt: iso(-2), reasons: [], owner: { id: 2, displayName: "Bertil" }, summary: "Bertil", url: "/person/2", hidden: false }], reasons: { spam: "innehållet är reklam eller spam", ovrigt: "innehållet bryter mot användarvillkoren" } } };
  if (p.startsWith("/admin")) return { json: { observations: [] } };
  if (p === "/notifications") return { json: { notifications: [{ id: 1, kind: "comment", actor: { id: 2, displayName: "Bertil" }, text: "Bertil kommenterade din tur.", url: "/turer/5", createdAt: iso(-1), read: false }, { id: 2, kind: "moderation", actor: { id: 1, displayName: "Snöläge" }, text: "Din kommentar har tagits bort efter en anmälan.", url: "/om-appen#villkor", createdAt: iso(-3), read: true }], unread: 1, people: { 2: { avatarPath: null, xp: 420 } } } };
  if (p === "/notifications/unread") return { json: { unread: 1 } };
  if (p.startsWith("/notifications/push")) return { json: { enabled: false } };
  if (p === "/forecasts/season") { const days = []; for (let d = 0; d < 120; d++) { const dt = new Date(Date.UTC(2026, 1, 1) + d * 864e5).toISOString().slice(0, 10); days.push({ date: dt, danger: d % 9 === 0 ? null : 1 + (d % 4), label: d % 9 === 0 ? "Ej bedömd" : null, problems: d % 3 ? ["Drevsnöflak"] : [] }); } return { json: { regionId: u.searchParams.get("region"), season: Number(u.searchParams.get("season")) || 2025, days, levels: {}, problems: [{ type: "drevsnoflak", name: "Drevsnöflak", days: 80 }] } }; }
  if (p === "/trips") return { json: { trips: [{ id: 3, regionId: "kebnekaisefjallen", date: new Date(now + 864e5).toISOString().slice(0, 10), notified: false, routeId: 3, routeTitle: "Plan", invites: [{ id: 1, user: { id: 2, displayName: "Bertil" }, status: "accepted" }], company: [] }], invitations: [{ id: 9, from: { id: 2, displayName: "Bertil" }, regionId: "kebnekaisefjallen", date: new Date(now + 2 * 864e5).toISOString().slice(0, 10), routeTitle: "Sydtoppen" }] } };
  if (p === "/warnings") return { json: { regions: { kebnekaisefjallen: [{ id: "1-1", level: "yellow", event: { sv: "Mycket hård vind", en: "Very strong wind" }, area: { sv: "Fjällen i Norrbotten", en: "The mountains of Norrbotten" }, start: iso(-2), end: iso(30), text: { sv: "Västlig vind 25 m/s i byarna.", en: "Westerly wind, gusts 25 m/s." } }] } } };
  if (p === "/tours/sources") return { json: { refs: [] } };
  if (p === "/native/status") return { json: { enabled: false } };
  return { status: 404, json: { error: "x" } };
}

export { now, iso, user, tour, obs, route, person, forecasts };
