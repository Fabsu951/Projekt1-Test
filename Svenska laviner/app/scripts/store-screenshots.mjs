// App Store / Google Play screenshots of the built site (dist/), with sample
// forecasts, people and tours but the real map tiles from the worker.
// Run by .github/workflows/store-screenshots.yml; locally:
//   npx vite preview --port 4173 &   (after a build with VITE_MAP_PROXY_URL)
//   API=<VITE_MAP_PROXY_URL> node scripts/store-screenshots.mjs out/
// Phone size: 440×956 at 3× = 1320×2868 (App Store 6.9", also fine for Play).
import { chromium } from "playwright";
import fs from "node:fs";

const API = process.env.API ?? "https://fjallkoll-worker.fabian-n-sund.workers.dev";
const SITE = process.env.SITE ?? "http://localhost:4173";
const OUT = process.argv[2] ?? "screenshots";
const LANG = process.env.LANG_UI ?? "sv";
fs.mkdirSync(OUT, { recursive: true });

const now = Date.now();
const iso = (h) => new Date(now + h * 3600e3).toISOString();
const day = (d) => new Date(now + d * 864e5).toISOString().slice(0, 10);

// The planned route: Kebnekaise fjällstation up Tarfaladalen to Tarfala.
const PLAN = [[67.8496, 18.6094], [67.8565, 18.6150], [67.8640, 18.6185], [67.8735, 18.6215], [67.8830, 18.6205], [67.8925, 18.6170], [67.9030, 18.6130], [67.9115, 18.6110]];
// A recorded tour: Kebnekaise fjällstation up to the south summit, roughly.
const ROUTE = [[67.8496, 18.6094], [67.8585, 18.5935], [67.8668, 18.5760], [67.8768, 18.5590], [67.8868, 18.5420], [67.8960, 18.5250], [67.9008, 18.5172]];
const TRACK = ROUTE.flatMap(([lat, lon], i) => {
  const next = ROUTE[i + 1];
  if (!next) return [[lat, lon, 2096, now - 3600e3]];
  return Array.from({ length: 12 }, (_, k) => {
    const f = k / 12;
    const ele = 700 + (i + f) * 230;
    return [lat + (next[0] - lat) * f + Math.sin(k) * 0.0004, lon + (next[1] - lon) * f, Math.round(ele), now - 9 * 3600e3 + (i * 12 + k) * 400e3];
  });
});

const smhi = {
  timeSeries: Array.from({ length: 48 }, (_, i) => ({
    time: iso(i),
    data: { air_temperature: -8 + Math.sin(i / 6) * 3, wind_speed: 6 + (i % 7), wind_from_direction: 250 + (i % 5) * 8, wind_speed_of_gust: 11 + (i % 7), symbol_code: i % 9 < 4 ? 3 : 15, precipitation_amount_mean: i % 9 < 4 ? 0 : 0.6 },
  })),
};
const problem = (type, name, aspects, elevations, sensitivity, size, where) => ({ type, name, aspects, elevations, metersAbove: null, metersBelow: null, sensitivity, size, where, infoUrl: null });
const levels = { kebnekaisefjallen: 3, riksgransfjallen: 3, "vastra-vindelfjallen": 2, "sodra-lapplandsfjallen": 2, "sodra-jamtlandsfjallen": 2, "vastra-harjedalsfjallen": 1 };
const forecasts = {
  regions: Object.entries(levels).map(([id, danger]) => ({
    regionId: id, sourceUrl: "https://www.lavinprognoser.se/", fetchError: null, danger, seasonOver: false, notAssessed: false, source: "api",
    headline: danger === 3 ? "Drevsnöflak på kalfjället" : danger === 2 ? "Lokala drevsnöflak i branta läsidor" : "Generellt stabila förhållanden",
    publishedText: "idag 08:00",
    mainMessage: danger === 3 ? "Kraftig västlig vind har lagt drevsnö i östliga läsidor. Flaken är lätta att utlösa för en enskild skidåkare." : "Undvik branta, nyladdade läsidor.",
    problems: danger >= 2
      ? [problem("drevsnoflak", "Drevsnöflak", ["N", "NO", "O", "SO"], ["kalfjall", "tradgrans"], "Lätt att utlösa", "Storlek 2", "Läsidor och raviner"),
         ...(danger === 3 ? [problem("bestaende_flak", "Bestående flak", ["N", "NO"], ["kalfjall"], "Svårt att utlösa", "Storlek 3", "Tunt snötäcke nära stenar")] : [])]
      : [],
    trend: { date: day(1), danger: danger === 3 ? 2 : danger, label: null, text: "Vinden avtar och flaken stabiliseras långsamt." },
  })),
};
const user = { id: 1, email: "anna@example.se", displayName: "Anna Lind", isAdmin: false, emailVerified: true, canPost: true, avatarPath: null, xp: 1040, lang: LANG };
const tour = {
  dangerSigns: ["skjutsprickor"], id: 5, userId: 2, author: "Erik Holm", title: "Kebnekaise sydtoppen via Västra leden", description: "Kall och klar dag. Skjutsprickor i en liten läsida på 1500 m, annars stabilt.",
  startedAt: iso(-30), durationS: 9 * 3600, distanceM: 19800, ascentM: 1450, descentM: 1450, maxElevationM: 2096, regionId: "kebnekaisefjallen",
  shared: true, visibility: "public", hideEndsM: 500, pin: ROUTE[0], createdAt: iso(-20),
};
const obs = (id, type, h, text, signs, lat, lon, author = "Erik Holm") => ({
  id, userId: 2, author, type, lat, lon, regionId: "kebnekaisefjallen", observedAt: iso(h), createdAt: iso(h + 1), description: text,
  imagePath: null, hidden: false, reportCount: 0, dangerSigns: signs, snowDepthCm: null,
});
const observations = [
  obs(8, "lavin", -5, "Färsk flaklavin i nordostsluttning under Vierranvarri, storlek 2, utlöst naturligt under natten.", ["farska_laviner"], 67.88, 18.57),
  obs(9, "sprickor", -26, "Skjutsprickor i en liten läsida på 1500 m.", ["skjutsprickor"], 67.875, 18.56, "Sara Berg"),
  obs(10, "ovrigt", -50, "Kraftigt snödrev på kalfjället, vind ca 15 m/s från väst.", ["snodrev"], 67.86, 18.6, "Sara Berg"),
];
const route = { id: 3, title: "Tarfaladalen", waypoints: PLAN, distanceM: 7100, ascentM: 450, descentM: 20, regionId: "kebnekaisefjallen", shared: false, mine: true, createdAt: iso(-48), updatedAt: iso(-48) };

function mock(url) {
  const u = new URL(url);
  const p = u.pathname;
  if (u.host.includes("metobs")) return { status: 404 };
  if (u.host.includes("smhi")) return u.host.includes("metfcst") ? { json: smhi } : u.host.includes("warnings") ? { json: { regions: {} } } : { status: 404 };
  if (!url.startsWith(API)) return null; // the site itself, map and elevation tiles, fonts
  if (p.startsWith("/tiles/") || p.startsWith("/terrain/") || p.startsWith("/images/")) return null; // real tiles
  if (p === "/forecasts") return { json: forecasts };
  if (p.startsWith("/forecasts/history")) {
    const lv = levels[u.searchParams.get("region")] ?? 2;
    return { json: { days: Array.from({ length: 7 }, (_, i) => ({ date: day(i - 6), danger: [2, 2, 3, 3, 2, 3, lv][i], problems: [] })) } };
  }
  if (p === "/auth/me") return { json: { user } };
  if (p === "/auth/lang") return { json: { lang: LANG } };
  if (p === "/auth/favorites") return { json: { favorites: ["kebnekaisefjallen", "riksgransfjallen"] } };
  if (p === "/push/key") return { json: { key: null } };
  if (p.startsWith("/observations")) return { json: { observations } };
  if (p === "/tours/lines") return { json: { lines: [{ id: 5, title: tour.title, startedAt: tour.startedAt, points: ROUTE }] } };
  if (p === "/tours") return { json: { tours: [tour] } };
  if (p.startsWith("/tours/")) return { json: { tour, track: TRACK } };
  if (p === "/routes") return { json: { routes: [route] } };
  if (p.startsWith("/routes/")) return { json: { route } };
  if (p === "/feed") return { json: { items: [
    { type: "tour", id: 5, createdAt: iso(-20), tour, line: ROUTE, likes: 4, likedByMe: true, comments: 2 },
    { type: "observation", id: 8, createdAt: iso(-4), observation: observations[0], likes: 2, likedByMe: false, comments: 1 },
  ], people: { 2: { avatarPath: null, xp: 1650, isAdmin: false } }, nextBefore: null } };
  if (p === "/people/me/follows") return { json: { following: [], followers: [] } };
  if (p === "/people/me/blocks") return { json: { people: [] } };
  if (p.startsWith("/people")) return { json: { people: [] } };
  if (p === "/comments") return { json: { comments: [], likes: 4, likedByMe: true, people: {} } };
  if (p === "/notifications/unread") return { json: { unread: 0 } };
  if (p.startsWith("/notifications")) return { json: { notifications: [], unread: 0, people: {} } };
  if (p === "/trips") return { json: { trips: [{ id: 3, regionId: "kebnekaisefjallen", date: day(1), notified: false, routeId: 3, routeTitle: route.title, invites: [{ id: 1, user: { id: 2, displayName: "Erik Holm" }, status: "accepted" }], company: [] }], invitations: [] } };
  if (p === "/warnings") return { json: { regions: {} } };
  if (p === "/native/status") return { json: { enabled: false } };
  return { status: 404, json: { error: "x" } };
}

const SHOTS = [
  { name: "1-idag", path: "/", theme: "light" },
  { name: "2-omrade", path: "/omrade/kebnekaisefjallen", theme: "dark" },
  { name: "3-rutt", path: "/karta?rutt=3", theme: "light", wait: 6000, click: /Helskärm|Full screen/ },
  { name: "4-tur", path: "/turer/5", theme: "dark", wait: 4000 },
  { name: "5-observera", path: "/observationer/snabb", theme: "light" },
  { name: "6-observationer", path: "/observationer", theme: "dark" },
];

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const shot of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    colorScheme: shot.theme, locale: LANG === "sv" ? "sv-SE" : "en-GB", timezoneId: "Europe/Stockholm",
    permissions: ["geolocation"], geolocation: { latitude: 67.85, longitude: 18.6, accuracy: 8 },
  });
  await ctx.addInitScript(([lang, theme]) => {
    localStorage.setItem("CapacitorStorage.fjallkoll:auth-token", "demo");
    localStorage.setItem("fjallkoll:language", lang);
    localStorage.setItem("fjallkoll:theme", theme);
    localStorage.setItem("fjallkoll:welcome-done", "1");
    localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify(["kebnekaisefjallen", "riksgransfjallen"]));
  }, [LANG, shot.theme]);
  await ctx.route("**/*", (r) => {
    const res = mock(r.request().url());
    if (!res) return r.continue();
    return r.fulfill({ status: res.status ?? 200, contentType: "application/json", body: JSON.stringify(res.json ?? {}) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", shot.name, e.message));
  await page.goto(SITE + shot.path, { waitUntil: "networkidle" }).catch(() => {});
  if (shot.click) {
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: shot.click }).first().click().catch((e) => console.log("click", shot.name, e.message));
  }
  await page.waitForTimeout(shot.wait ?? 2500);
  const file = `${OUT}/${LANG}-${shot.name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
  await ctx.close();
}
await browser.close();
