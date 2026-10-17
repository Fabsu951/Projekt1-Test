// Screen recordings for clip A1 (marknad/manus/A1.md), 1080×1920 at 30 fps,
// of the built site with sample people/forecasts but the real map from the
// worker. Run by .github/workflows/a1-klipp.yml; locally (map tiles stubbed):
//   npx vite preview --port 4173 &        (in "Svenska laviner/app")
//   cp a1-klipp.mjs "../../app/scripts/" && STUB_TILES=1 node "../../app/scripts/a1-klipp.mjs" out/
// Frames come from Chrome's screencast (sharper than Playwright's video) and
// are joined with ffmpeg. Zooms are rendered frame by frame (wait for the
// tiles, screenshot) so they stay smooth; for that the served Leaflet bundle
// is patched to expose the map as window.__map (recording only).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const API = process.env.API ?? "https://fjallkoll-worker.fabian-n-sund.workers.dev";
const SITE = process.env.SITE ?? "http://localhost:4173";
const OUT = path.resolve(process.argv[2] ?? "klipp");
const STUB = process.env.STUB_TILES === "1";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const W = 432, H = 768, DPR = 2.5; // → 1080×1920
fs.mkdirSync(OUT, { recursive: true });

const now = Date.now();
const iso = (h) => new Date(now + h * 3600e3).toISOString();
const day = (d) => new Date(now + d * 864e5).toISOString().slice(0, 10);

// Up Tarfaladalen along the summer trail to Tarfalastugan.
const PLAN = [[67.8774, 18.6468], [67.886, 18.6462], [67.8924, 18.6445], [67.8954, 18.6401], [67.901, 18.6266], [67.9074, 18.6177], [67.9143, 18.611], [67.9199, 18.606]];
const KEBNEKAISE = [67.9, 18.55];

const smhi = {
  timeSeries: Array.from({ length: 48 }, (_, i) => ({
    time: iso(i),
    data: { air_temperature: -8 + Math.sin(i / 6) * 3, wind_speed: 6 + (i % 7), wind_from_direction: 250 + (i % 5) * 8, wind_speed_of_gust: 11 + (i % 7), symbol_code: i % 9 < 4 ? 3 : 15, precipitation_amount_mean: i % 9 < 4 ? 0 : 0.6 },
  })),
};
const problem = (type, name, aspects, elevations, sensitivity, size, where) => ({ type, name, aspects, elevations, metersAbove: null, metersBelow: null, sensitivity, size, where, infoUrl: null });
const levels = { kebnekaisefjallen: 3, riksgransfjallen: 3, "vastra-vindelfjallen": 2, "sodra-lapplandsfjallen": 2, "sodra-jamtlandsfjallen": 2, "vastra-harjedalsfjallen": 1 };
const exampleForecasts = {
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
// What the app really shows before the season starts.
const offSeasonForecasts = {
  regions: Object.keys(levels).map((id) => ({
    regionId: id, sourceUrl: "https://www.lavinprognoser.se/", fetchError: null, danger: null, seasonOver: true, notAssessed: false, source: "api",
    headline: "Prognossäsongen är avslutad", publishedText: null, mainMessage: null, problems: [], trend: null,
  })),
};
const user = { id: 1, email: "anna@example.se", displayName: "Anna Lind", isAdmin: false, emailVerified: true, canPost: true, avatarPath: null, xp: 1040, lang: "sv" };
const observations = [
  { id: 8, userId: 2, author: "Erik Holm", type: "lavin", lat: 67.88, lon: 18.57, regionId: "kebnekaisefjallen", observedAt: iso(-5), createdAt: iso(-4), description: "Färsk flaklavin i nordostsluttning under Vierranvarri, storlek 2, utlöst naturligt under natten.", imagePath: null, hidden: false, reportCount: 0, dangerSigns: ["farska_laviner"], snowDepthCm: null },
];

function mock(url, forecasts) {
  const u = new URL(url);
  const p = u.pathname;
  if (STUB && (p.includes("/tiles/") || p.includes("/terrain/") || u.host.includes("mapterhorn") || u.host.includes("openstreetmap"))) return { png: true };
  if (u.host.includes("metobs")) return { status: 404 };
  if (u.host.includes("smhi")) return u.host.includes("metfcst") ? { json: smhi } : u.host.includes("warnings") ? { json: { regions: {} } } : { status: 404 };
  if (!url.startsWith(API)) return null; // the site itself, elevation tiles, fonts
  if (p.startsWith("/tiles/") || p.startsWith("/terrain/") || p.startsWith("/images/")) return null; // real map
  if (p === "/forecasts") return { json: forecasts };
  if (p.startsWith("/forecasts/history")) {
    const lv = forecasts === exampleForecasts ? levels[u.searchParams.get("region")] ?? 2 : null;
    return { json: { days: Array.from({ length: 7 }, (_, i) => ({ date: day(i - 6), danger: lv && [2, 2, 3, 3, 2, 3, lv][i], problems: [] })) } };
  }
  if (p === "/auth/me") return { json: { user } };
  if (p === "/auth/lang") return { json: { lang: "sv" } };
  if (p === "/auth/favorites") return { json: { favorites: ["kebnekaisefjallen", "riksgransfjallen"] } };
  if (p === "/push/key") return { json: { key: null } };
  if (p.startsWith("/observations")) return { json: { observations: forecasts === exampleForecasts ? observations : [] } };
  if (p === "/tours/lines") return { json: { lines: [] } };
  if (p === "/tours") return { json: { tours: [] } };
  if (p === "/routes") return { json: { routes: [] } };
  if (p === "/feed") return { json: { items: [], people: {}, nextBefore: null } };
  if (p.startsWith("/people")) return { json: { people: [], following: [], followers: [] } };
  if (p === "/notifications/unread") return { json: { unread: 0 } };
  if (p.startsWith("/notifications")) return { json: { notifications: [], unread: 0, people: {} } };
  if (p === "/trips") return { json: { trips: [], invitations: [] } };
  if (p === "/warnings") return { json: { regions: {} } };
  if (p === "/native/status") return { json: { enabled: false } };
  return { status: 404, json: { error: "x" } };
}

// 256×256 light grey PNG for stubbed tiles (local tests only).
const GREY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAACXBIWXMAAAABAAAAAQBPJcTWAAACwElEQVR4nO3TMQ0AMAzAsPLnt2MamcHoEUsGkCfz7oGsWS+ARQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQNoH3ecmCHPojhcAAAAASUVORK5CYII=", "base64");

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function open(pathname, { theme = "light", forecasts = exampleForecasts, label = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
    colorScheme: theme, locale: "sv-SE", timezoneId: "Europe/Stockholm", serviceWorkers: "block",
    permissions: ["geolocation"], geolocation: { latitude: 67.85, longitude: 18.6, accuracy: 8 },
  });
  await ctx.addInitScript(([theme, label]) => {
    localStorage.setItem("CapacitorStorage.fjallkoll:auth-token", "demo");
    localStorage.setItem("fjallkoll:language", "sv");
    localStorage.setItem("fjallkoll:theme", theme);
    localStorage.setItem("fjallkoll:welcome-done", "1");
    localStorage.setItem("fjallkoll:map-layers-open", "0");
    localStorage.removeItem("fjallkoll:route-draft");
    localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify(["kebnekaisefjallen", "riksgransfjallen"]));
    // A soft circle where the "finger" taps, like a screen recording with touches shown.
    addEventListener("pointerdown", (e) => {
      const dot = document.createElement("div");
      dot.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;` +
        "background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.25);pointer-events:none;z-index:99999;transition:transform .45s ease-out,opacity .45s ease-out";
      document.documentElement.appendChild(dot);
      requestAnimationFrame(() => { dot.style.transform = "scale(1.6)"; dot.style.opacity = "0"; });
      setTimeout(() => dot.remove(), 600);
    }, true);
    if (label) addEventListener("DOMContentLoaded", () => {
      const tag = document.createElement("div");
      tag.textContent = label;
      tag.style.cssText = "position:fixed;left:calc(50% - 26px);top:13px;transform:translateX(-50%);padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;" +
        "font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;z-index:99998";
      document.documentElement.appendChild(tag);
    });
  }, [theme, label]);
  await ctx.route("**/*", async (r) => {
    const url = r.request().url();
    if (url.startsWith(SITE) && /\/assets\/.*\.js$/.test(url)) {
      const res = await r.fetch();
      const body = (await res.text()).replace(/_initContainer:function\((\w)\)\{var (\w)=this\._container=/, "_initContainer:function($1){window.__map=this;var $2=this._container=");
      return r.fulfill({ response: res, body });
    }
    const res = mock(url, forecasts);
    if (!res) return r.continue();
    if (res.png) return r.fulfill({ status: 200, contentType: "image/png", body: GREY_PNG });
    return r.fulfill({ status: res.status ?? 200, contentType: "application/json", body: JSON.stringify(res.json ?? {}) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(SITE + pathname, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  return page;
}

// Records what happens during fn() and writes <name>.mp4.
async function record(page, name, fn) {
  const dir = path.join(OUT, `.frames-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    const file = path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DPR, maxHeight: H * DPR });
  const start = Date.now() / 1000;
  await fn();
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  if (!frames.length) throw new Error(`no frames for ${name}`);
  // Concat list: each frame lasts until the next one (screencast only sends changes).
  const lines = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - Math.max(f.t, i ? 0 : start)).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
    "-vf", "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-movflags", "+faststart", "-an", mp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${mp4}: ${frames.length} frames, ${(end - start).toFixed(1)} s`);
  return mp4;
}

const wait = (page, ms) => page.waitForTimeout(ms);
// Eased scroll of the window by dy pixels over ms.
const scroll = (page, dy, ms) => page.evaluate(([dy, ms]) => new Promise((done) => {
  const el = document.scrollingElement, from = el.scrollTop, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    el.scrollTop = from + dy * e;
    k < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
}), [dy, ms]);
// Slow pointer move so the tap circle and hover effects look like a hand.
async function tap(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not visible");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 8 });
  await wait(page, 150);
  await page.mouse.click(x, y);
}
// Zoom to `zoom` over `seconds`, drawn frame by frame: the target point keeps
// its place on screen while zooming and glides to the middle. Writes <name>.mp4.
async function zoomFrames(page, name, target, zoom, seconds) {
  const dir = path.join(OUT, `.frames-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  await page.evaluate(() => { window.__map.options.zoomSnap = 0; window.__map._fadeAnimated = false; });
  const n = Math.round(seconds * 30);
  for (let i = 0; i <= n; i++) {
    await page.evaluate(([t, z1, k]) => {
      const m = window.__map;
      if (!window.__zoomStart) {
        const z0 = m.getZoom();
        const d = m.project(m.getCenter(), z0).subtract(m.project(t, z0));
        window.__zoomStart = { z0, d };
      }
      const { z0, d } = window.__zoomStart;
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
      const z = z0 + (z1 - z0) * ease(k);
      const c = m.project(t, z).add(d.multiplyBy(1 - ease(Math.min(1, k * 1.15))));
      m.setView(m.unproject(c, z), z, { animate: false });
      if (k === 1) window.__zoomStart = null;
    }, [target, zoom, i / n]);
    await page.waitForFunction(() => [...document.querySelectorAll(".leaflet-tile-pane img.leaflet-tile")].every((img) => img.complete),
      null, { timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  }
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(dir, "%05d.jpg"),
    "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-movflags", "+faststart", "-an", mp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${mp4}: ${n + 1} frames`);
  return mp4;
}
// A still of the current screen for `seconds`, so clips can end calmly.
async function hold(page, name, seconds) {
  const png = path.join(OUT, `.${name}.png`);
  await page.screenshot({ path: png });
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-t", String(seconds), "-i", png,
    "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-an", mp4]);
  fs.rmSync(png);
  return mp4;
}
// Joins mp4 parts (same size, rate and codec) into <name>.mp4 and removes them.
function join(name, parts) {
  const list = path.join(OUT, `.${name}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", mp4]);
  for (const p of [list, ...parts]) fs.rmSync(p);
  console.log(`${mp4}: joined ${parts.length} parts`);
}
const jump = (page, center, zoom) => page.evaluate(([c, z]) => window.__map.setView(c, z, { animate: false }), [center, zoom]);
const tilesLoaded = (page) => page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll(".leaflet-tile-pane img.leaflet-tile")];
  return imgs.length > 0 && imgs.every((i) => i.complete);
}, null, { timeout: 20000 }).catch(() => console.log("tiles still loading"));
const button = (page, name) => page.getByRole("button", { name, exact: true }).first();
// Hide everything but the map (and its credits) for calm shots.
const cleanMap = (page) => page.addStyleTag({ content: "body *{visibility:hidden!important} .leaflet-tile-pane,.leaflet-tile-pane *,.leaflet-overlay-pane,.leaflet-overlay-pane *,.leaflet-control-attribution,.leaflet-control-attribution *{visibility:visible!important}" });

const CLIPS = {
  // Scene 3: start page → Kebnekaisefjällen. Example forecasts, labelled.
  "3-startsida-exempel": async () => {
    const page = await open("/", { theme: "dark", label: "Exempelprognos" });
    await record(page, "3-startsida-exempel", async () => {
      await wait(page, 1500);
      await scroll(page, 260, 1800);
      await wait(page, 700);
      await scroll(page, -260, 1200);
      await wait(page, 500);
      await tap(page, page.locator('a[href="/omrade/kebnekaisefjallen"]').first());
      await wait(page, 2000);
      await scroll(page, 520, 2600);
      await wait(page, 1500);
    });
    await page.context().close();
  },
  // Scene 3 as the app looks before the season (no levels).
  "3-startsida-utanfor-sasong": async () => {
    const page = await open("/", { theme: "dark", forecasts: offSeasonForecasts });
    await record(page, "3-startsida-utanfor-sasong", async () => {
      await wait(page, 1500);
      await scroll(page, 260, 1800);
      await wait(page, 700);
      await scroll(page, -260, 1200);
      await wait(page, 500);
      await tap(page, page.locator('a[href="/omrade/kebnekaisefjallen"]').first());
      await wait(page, 2000);
      await scroll(page, 520, 2600);
      await wait(page, 1500);
    });
    await page.context().close();
  },
  // Scene 4: turn on Naturvårdsverket's slope map, full screen, fly in to Kebnekaise.
  "4-karta-lutning": async () => {
    const page = await open("/karta", { forecasts: offSeasonForecasts });
    await jump(page, [66.2, 16.5], 6);
    await tilesLoaded(page);
    const a = await record(page, ".4a", async () => {
      await wait(page, 1000);
      await tap(page, button(page, "Helskärm"));
      await wait(page, 900);
      await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
      await wait(page, 900);
      const slope = page.getByRole("checkbox", { name: "Lutning", exact: true });
      await slope.scrollIntoViewIfNeeded();
      await tap(page, slope);
      await wait(page, 1200);
      await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
      await wait(page, 1500);
    });
    const b = await zoomFrames(page, ".4b", KEBNEKAISE, 12, 6);
    await tilesLoaded(page);
    await wait(page, 1500);
    join("4-karta-lutning", [a, b, await hold(page, ".4c", 2.5)]);
    await page.context().close();
  },
  // Scene 5: draw a route up Tarfaladalen, then follow the height profile.
  "5-rutt": async () => {
    const page = await open("/karta", { forecasts: offSeasonForecasts });
    await tap(page, button(page, "Helskärm"));
    await wait(page, 600);
    await tap(page, button(page, "Planera rutt"));
    await wait(page, 1000);
    // Frame the route in the part of the map above the route panel.
    await page.evaluate(() => { window.__map.options.zoomSnap = 0.25; });
    await page.evaluate((pts) => window.__map.fitBounds(pts, { paddingTopLeft: [40, 110], paddingBottomRight: [40, 768 * 0.45 + 40], animate: false }), PLAN);
    await tilesLoaded(page);
    await wait(page, 1500);
    await record(page, "5-rutt", async () => {
      await wait(page, 1000);
      for (const ll of PLAN) {
        const { x, y } = await page.evaluate((ll) => {
          const p = window.__map.latLngToContainerPoint(ll), r = window.__map.getContainer().getBoundingClientRect();
          return { x: r.left + p.x, y: r.top + p.y };
        }, ll);
        await page.mouse.move(x, y, { steps: 10 });
        await wait(page, 120);
        await page.mouse.click(x, y);
        await wait(page, 650);
      }
      await wait(page, 2500); // heights and the profile
      const profile = page.locator(".elevation-profile svg, svg.elevation-profile").first();
      const box = await profile.boundingBox().catch(() => null);
      if (box) {
        await profile.scrollIntoViewIfNeeded().catch(() => {});
        const b = (await profile.boundingBox()) ?? box;
        await page.mouse.move(b.x + 8, b.y + b.height / 2, { steps: 6 });
        await page.mouse.move(b.x + b.width - 8, b.y + b.height / 2, { steps: 90 });
        await wait(page, 600);
      } else console.log("no profile found");
      await wait(page, 1500);
    });
    await page.context().close();
  },
  // Scene 6a fallback: the map slowly zooming out from Kebnekaise, no buttons.
  "6a-karta-zoomar-ut": async () => {
    const page = await open("/karta", { forecasts: offSeasonForecasts });
    await tap(page, button(page, "Helskärm"));
    await cleanMap(page);
    await jump(page, KEBNEKAISE, 13);
    await tilesLoaded(page);
    await wait(page, 2000);
    const a = await hold(page, ".6a", 1.5);
    const b = await zoomFrames(page, ".6b", KEBNEKAISE, 7.5, 8);
    join("6a-karta-zoomar-ut", [a, b, await hold(page, ".6c", 1.5)]);
    await page.context().close();
  },
};

for (const [name, run] of Object.entries(CLIPS)) {
  if (ONLY && !ONLY.includes(name)) continue;
  try {
    await run();
  } catch (e) {
    console.log("FAILED", name, e.message);
    process.exitCode = 1;
  }
}
await browser.close();
