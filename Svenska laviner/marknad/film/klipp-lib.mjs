// Shared helpers for recording marketing clips of the built site (dist/),
// 1080×1920 at 30 fps, with sample people/forecasts but the real map from
// the worker. Used by oktober-klipp.mjs (a1-klipp.mjs has its own copy).
// Frames come from Chrome's screencast and are joined with ffmpeg; zooms are
// rendered frame by frame, for which the served Leaflet bundle is patched to
// expose the map as window.__map (recording only).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const API = process.env.API ?? "https://fjallkoll-worker.fabian-n-sund.workers.dev";
export const SITE = process.env.SITE ?? "http://localhost:4173";
export const STUB = process.env.STUB_TILES === "1";
export const W = 432, H = 768, DPR = 2.5; // → 1080×1920

const now = Date.now();
export const iso = (h) => new Date(now + h * 3600e3).toISOString();
export const day = (d) => new Date(now + d * 864e5).toISOString().slice(0, 10);

// Sample data: never shown without a label saying it is an example.
const smhi = {
  timeSeries: Array.from({ length: 48 }, (_, i) => ({
    time: iso(i),
    data: { air_temperature: -8 + Math.sin(i / 6) * 3, wind_speed: 6 + (i % 7), wind_from_direction: 250 + (i % 5) * 8, wind_speed_of_gust: 11 + (i % 7), symbol_code: i % 9 < 4 ? 3 : 15, precipitation_amount_mean: i % 9 < 4 ? 0 : 0.6 },
  })),
};
export const problem = (type, name, aspects, elevations, sensitivity, size, where) => ({ type, name, aspects, elevations, metersAbove: null, metersBelow: null, sensitivity, size, where, infoUrl: null });
const ALL_ASPECTS = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
export const levels = { kebnekaisefjallen: 3, riksgransfjallen: 3, "vastra-vindelfjallen": 2, "sodra-lapplandsfjallen": 2, "sodra-jamtlandsfjallen": 2, "vastra-harjedalsfjallen": 1 };
export function exampleForecasts(problemsFor = (danger) => danger >= 2
  ? [problem("drevsnoflak", "Drevsnöflak", ["N", "NO", "O", "SO"], ["kalfjall", "tradgrans"], "Lätt att utlösa", "Storlek 2", "Läsidor och raviner"),
     ...(danger === 3 ? [problem("bestaende-flak", "Bestående flak", ["N", "NO"], ["kalfjall"], "Svårt att utlösa", "Storlek 3", "Tunt snötäcke nära stenar")] : [])]
  : []) {
  return {
    regions: Object.entries(levels).map(([id, danger]) => ({
      regionId: id, sourceUrl: "https://www.lavinprognoser.se/", fetchError: null, danger, seasonOver: false, notAssessed: false, source: "api",
      headline: danger === 3 ? "Drevsnöflak på kalfjället" : danger === 2 ? "Lokala drevsnöflak i branta läsidor" : "Generellt stabila förhållanden",
      publishedText: "idag 08:00",
      mainMessage: danger === 3 ? "Kraftig västlig vind har lagt drevsnö i läsidor. Flaken är lätta att utlösa för en enskild skidåkare." : "Undvik branta, nyladdade läsidor.",
      problems: problemsFor(danger),
      trend: { date: day(1), danger: danger === 3 ? 2 : danger, label: null, text: "Vinden avtar och flaken stabiliseras långsamt." },
    })),
  };
}
/** Drevsnöflak on every aspect above the trees, so the route check has something to mark. */
export const routeCheckForecasts = exampleForecasts((danger) => danger >= 2
  ? [problem("drevsnoflak", "Drevsnöflak", ALL_ASPECTS, ["kalfjall", "tradgrans"], "Lätt att utlösa", "Storlek 2", "Läsidor, raviner och branta sluttningar")]
  : []);
export const offSeasonForecasts = {
  regions: Object.keys(levels).map((id) => ({
    regionId: id, sourceUrl: "https://www.lavinprognoser.se/", fetchError: null, danger: null, seasonOver: true, notAssessed: false, source: "api",
    headline: "Prognossäsongen är avslutad", publishedText: null, mainMessage: null, problems: [], trend: null,
  })),
};

// From Tarfalastugan towards Kebnekaise's north top over steep ground.
export const STEEP_ROUTE = [[67.9199, 18.606], [67.9168, 18.5985], [67.9136, 18.5895], [67.9104, 18.5795], [67.9075, 18.5685], [67.9049, 18.5565], [67.9027, 18.5445], [67.9014, 18.531]];
const user = { id: 1, email: "anna@example.se", displayName: "Anna Lind", isAdmin: false, emailVerified: true, canPost: true, avatarPath: null, xp: 1040, lang: "sv" };
const obs = (id, type, h, text, signs, lat, lon, author = "Erik Holm") => ({
  id, userId: 2, author, type, lat, lon, regionId: "kebnekaisefjallen", observedAt: iso(h), createdAt: iso(h + 1), description: text,
  imagePath: null, hidden: false, reportCount: 0, dangerSigns: signs, snowDepthCm: null,
});
const observations = [
  obs(9, "sprickor", -26, "Skjutsprickor i en liten läsida på 1500 m.", ["skjutsprickor"], 67.875, 18.56, "Sara Berg"),
  obs(10, "ovrigt", -50, "Kraftigt snödrev på kalfjället, vind ca 15 m/s från väst.", ["snodrev"], 67.86, 18.6, "Sara Berg"),
];
const route = { id: 3, title: "Tarfala – Kebnekaise", waypoints: STEEP_ROUTE, distanceM: 5200, ascentM: 930, descentM: 20, regionId: "kebnekaisefjallen", shared: false, mine: true, createdAt: iso(-48), updatedAt: iso(-48) };

function mock(req, forecasts, posted) {
  const url = req.url();
  const u = new URL(url);
  const p = u.pathname;
  if (STUB && (p.includes("/tiles/") || p.includes("/terrain/") || u.host.includes("mapterhorn") || u.host.includes("openstreetmap"))) return { png: true };
  if (u.host.includes("metobs")) return { status: 404 };
  if (u.host.includes("smhi")) return u.host.includes("metfcst") ? { json: smhi } : u.host.includes("warnings") ? { json: { regions: {} } } : { status: 404 };
  if (!url.startsWith(API)) return null; // the site itself, map and elevation tiles, fonts
  if (p.startsWith("/tiles/") || p.startsWith("/terrain/") || p.startsWith("/images/")) return null; // real map
  if (p === "/forecasts") return { json: forecasts };
  if (p.startsWith("/forecasts/history")) {
    const lv = forecasts === offSeasonForecasts ? null : levels[u.searchParams.get("region")] ?? 2;
    return { json: { days: Array.from({ length: 7 }, (_, i) => ({ date: day(i - 6), danger: lv && [2, 2, 3, 3, 2, 3, lv][i], problems: [] })) } };
  }
  if (p === "/auth/me") return { json: { user } };
  if (p === "/auth/lang") return { json: { lang: "sv" } };
  if (p === "/auth/favorites") return { json: { favorites: ["kebnekaisefjallen", "riksgransfjallen"] } };
  if (p === "/push/key") return { json: { key: null } };
  if (p === "/observations" && req.method() === "POST") {
    posted.push(obs(11, "sprickor", 0, "Snabbobservation: Skjutsprickor, Snödrev. Nordostsluttning ovanför Tarfala, ca 1300 m.", ["skjutsprickor", "snodrev"], 67.91, 18.6, "Anna Lind"));
    return { json: { observation: posted.at(-1) } };
  }
  if (p.startsWith("/observations")) return { json: { observations: forecasts === offSeasonForecasts ? [] : [...posted, ...observations] } };
  if (p === "/tours/lines") return { json: { lines: [] } };
  if (p === "/tours") return { json: { tours: [] } };
  if (p === "/routes") return { json: { routes: [route] } };
  if (p.startsWith("/routes/")) return { json: { route } };
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
const GREY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAACXBIWXMAAAABAAAAAQBPJcTWAAACwElEQVR4nO3TMQ0AMAzAsPLnt2MamcHoEUsGkCfz7oGsWS+ARQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQNoH3ecmCHPojhcAAAAASUVORK5CYII=", "base64");

export function recorder(outDir) {
  const OUT = path.resolve(outDir);
  fs.mkdirSync(OUT, { recursive: true });
  let browser;

  // `fresh` opens the site like a first visit (signed out, nothing starred, welcome guide);
  // `extra(request)` may answer worker requests before the shared sample answers.
  async function open(pathname, { theme = "light", forecasts = exampleForecasts(), label = null, fresh = false, extra = null, height = H } = {}) {
    browser ??= await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
    const ctx = await browser.newContext({
      viewport: { width: W, height }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
      colorScheme: theme, locale: "sv-SE", timezoneId: "Europe/Stockholm", serviceWorkers: "block",
      permissions: ["geolocation"], geolocation: { latitude: 67.91, longitude: 18.6, accuracy: 8 },
    });
    await ctx.addInitScript(([theme, label, fresh]) => {
      localStorage.setItem("fjallkoll:language", "sv");
      localStorage.setItem("fjallkoll:theme", theme);
      localStorage.setItem("fjallkoll:map-layers-open", "0");
      localStorage.removeItem("fjallkoll:route-draft");
      if (!fresh) {
        localStorage.setItem("CapacitorStorage.fjallkoll:auth-token", "demo");
        localStorage.setItem("fjallkoll:welcome-done", "1");
        localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify(["kebnekaisefjallen", "riksgransfjallen"]));
      }
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
        tag.className = "clip-label";
        tag.textContent = label;
        // In the header between the logo and the bell; on the full-screen map, under its buttons.
        const style = document.createElement("style");
        style.textContent = ".clip-label{position:fixed;left:calc(50% - 26px);top:13px;transform:translateX(-50%);padding:4px 10px;border-radius:999px;" +
          "background:rgba(0,0,0,.6);color:#fff;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;z-index:99998}" +
          "html:has(.fullscreen-icon--exit) .clip-label{left:auto;right:10px;top:58px;transform:none}";
        document.documentElement.append(style, tag);
      });
    }, [theme, label, fresh]);
    const posted = [];
    await ctx.route("**/*", async (r) => {
      const url = r.request().url();
      if (url.startsWith(SITE) && /\/assets\/.*\.js$/.test(url)) {
        const res = await r.fetch();
        const body = (await res.text()).replace(/_initContainer:function\((\w)\)\{var (\w)=this\._container=/, "_initContainer:function($1){window.__map=this;var $2=this._container=");
        return r.fulfill({ response: res, body });
      }
      const res = (r.request().url().startsWith(API) && extra?.(r.request())) || mock(r.request(), forecasts, posted);
      if (!res) return r.continue().catch(() => {});
      if (res.png) return r.fulfill({ status: 200, contentType: "image/png", body: GREY_PNG });
      return r.fulfill({ status: res.status ?? 200, contentType: "application/json", body: JSON.stringify(res.json ?? {}) });
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("pageerror", e.message));
    await page.goto(SITE + pathname, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    return page;
  }

  const encode = (input, out, extra = []) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input,
    "-vf", "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-movflags", "+faststart", "-an", ...extra, out]);

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
    encode(["-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt")], mp4);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${mp4}: ${frames.length} frames, ${(end - start).toFixed(1)} s`);
    return mp4;
  }

  // Zoom to `zoom` over `seconds`, drawn frame by frame: the target point keeps
  // its place on screen while zooming and glides to the middle.
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
    encode(["-framerate", "30", "-i", path.join(dir, "%05d.jpg")], mp4);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${mp4}: ${n + 1} frames`);
    return mp4;
  }

  // A still of the current screen for `seconds`, so clips can end calmly.
  async function hold(page, name, seconds) {
    const png = path.join(OUT, `.${name}.png`);
    await page.screenshot({ path: png });
    const mp4 = path.join(OUT, `${name}.mp4`);
    encode(["-loop", "1", "-framerate", "30", "-t", String(seconds), "-i", png], mp4);
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
    return mp4;
  }

  // A full-screen picture, or one element of the page, as <name>.png.
  async function shot(page, name, locator = null) {
    const file = path.join(OUT, `${name}.png`);
    await (locator ?? page).screenshot({ path: file });
    console.log(file);
    return file;
  }

  // Two pictures as a still that fades from the first to the second, as <name>.mp4.
  function fade(name, first, second, seconds = 3) {
    const mp4 = path.join(OUT, `${name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-t", String(seconds), "-i", first, "-loop", "1", "-t", String(seconds), "-i", second,
      "-filter_complex", `[0][1]xfade=transition=fade:duration=1:offset=${seconds - 1},scale=1080:1920:flags=lanczos,fps=30,format=yuv420p`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", "-an", mp4]);
    console.log(mp4);
    return mp4;
  }

  const close = () => browser?.close();
  return { OUT, open, record, zoomFrames, hold, join, shot, fade, close };
}

export const wait = (page, ms) => page.waitForTimeout(ms);
// Eased scroll of the window (or an element) by dy pixels over ms.
export const scroll = (page, dy, ms, selector = null) => page.evaluate(([dy, ms, selector]) => new Promise((done) => {
  const el = selector ? document.querySelector(selector) : document.scrollingElement;
  const from = el.scrollTop, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    el.scrollTop = from + dy * e;
    k < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
}), [dy, ms, selector]);
// Eased scroll so that `selector` ends `offset` px below the top of the window.
export async function scrollTo(page, selector, ms, offset = 70) {
  const dy = await page.evaluate(([s, o]) => document.querySelector(s).getBoundingClientRect().top - o, [selector, offset]);
  await scroll(page, dy, ms);
}
// Slow pointer move so the tap circle and hover effects look like a hand.
export async function tap(page, locator) {
  // Keep clear of the sticky header and the tab bar at the bottom.
  const moved = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top >= 90 && r.bottom <= innerHeight - 90) return false;
    for (let n = el; n; n = n.parentElement) {
      if (/fixed|sticky/.test(getComputedStyle(n).position)) return false; // header, tab bar, map buttons
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  });
  if (moved) await wait(page, 700);
  const box = await locator.boundingBox();
  if (!box) throw new Error("not visible");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 8 });
  await wait(page, 150);
  await page.mouse.click(x, y);
}
export const jump = (page, center, zoom) => page.evaluate(([c, z]) => window.__map.setView(c, z, { animate: false }), [center, zoom]);
export const tilesLoaded = (page) => page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll(".leaflet-tile-pane img.leaflet-tile")];
  return imgs.length > 0 && imgs.every((i) => i.complete);
}, null, { timeout: 20000 }).catch(() => console.log("tiles still loading"));
export const button = (page, name) => page.getByRole("button", { name, exact: true }).first();
// Hide everything but the map (and its credits) for calm shots; returns a function that undoes it.
export async function cleanMap(page) {
  const style = await page.addStyleTag({ content: "body *{visibility:hidden!important} .leaflet-tile-pane,.leaflet-tile-pane *,.leaflet-overlay-pane,.leaflet-overlay-pane *,.leaflet-control-attribution,.leaflet-control-attribution *,.clip-ring{visibility:visible!important}" });
  return () => style.evaluate((s) => s.remove());
}
// Searches `box` [south, west, north, east] for ground about `target`° steep between
// minH and maxH metres, where the ground around is about as steep, from the same
// ~30 m height data the app uses (Mapterhorn). Returns {lat, lon, slope, height} or null.
export const findSteepSpot = (page, { box, target, tol = 1.5, minH = 0, maxH = 9000 }) => page.evaluate(async ([box, target, tol, minH, maxH]) => {
  const Z = 13, tiles = new Map();
  async function tile(x, y) {
    const key = `${x}/${y}`;
    if (!tiles.has(key)) tiles.set(key, (async () => {
      const blob = await (await fetch(`https://tiles.mapterhorn.com/${Z}/${x}/${y}.webp`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0);
      return { size: bmp.width, data: g.getImageData(0, 0, bmp.width, bmp.height).data };
    })());
    return tiles.get(key);
  }
  async function height(lat, lon) {
    const n = 2 ** Z, r = (lat * Math.PI) / 180;
    const fx = ((lon + 180) / 360) * n, fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const t = await tile(Math.floor(fx), Math.floor(fy));
    const px = Math.min(t.size - 1, Math.floor((fx % 1) * t.size)), py = Math.min(t.size - 1, Math.floor((fy % 1) * t.size));
    const i = (py * t.size + px) * 4;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
  }
  async function slope(lat, lon) {
    const dLat = 30 / 111320, dLon = 30 / (111320 * Math.cos((lat * Math.PI) / 180));
    const [n, s, e, w] = await Promise.all([height(lat + dLat, lon), height(lat - dLat, lon), height(lat, lon + dLon), height(lat, lon - dLon)]);
    return (Math.atan(Math.hypot((n - s) / 60, (e - w) / 60)) * 180) / Math.PI;
  }
  const [south, west, north, east] = box;
  let best = null;
  for (let lat = south; lat <= north; lat += 0.0015) {
    for (let lon = west; lon <= east; lon += 0.003) {
      const s = await slope(lat, lon);
      if (Math.abs(s - target) > tol) continue;
      const h = await height(lat, lon);
      if (h < minH || h > maxH) continue;
      const d = 120 / 111320, dl = 120 / (111320 * Math.cos((lat * Math.PI) / 180));
      const around = await Promise.all([slope(lat + d, lon), slope(lat - d, lon), slope(lat, lon + dl), slope(lat, lon - dl)]);
      const spread = Math.max(...around.map((a) => Math.abs(a - s)));
      if (!best || spread < best.spread) best = { lat, lon, slope: s, height: h, spread };
    }
  }
  return best;
}, [box, target, tol, minH, maxH]).catch((e) => (console.log("slope search failed", e.message), null));

// Click the route points one by one, like a finger drawing the route.
export async function drawRoute(page, points, gapMs = 650) {
  for (const ll of points) {
    const { x, y } = await page.evaluate((ll) => {
      const p = window.__map.latLngToContainerPoint(ll), r = window.__map.getContainer().getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    }, ll);
    await page.mouse.move(x, y, { steps: 10 });
    await wait(page, 120);
    await page.mouse.click(x, y);
    await wait(page, gapMs);
  }
}
// Follow the height profile with the "finger", left to right.
export async function followProfile(page) {
  const profile = page.locator(".elevation-profile").first();
  if (!(await profile.count())) return console.log("no profile found");
  await profile.scrollIntoViewIfNeeded().catch(() => {});
  const b = await profile.boundingBox();
  if (!b) return;
  await page.mouse.move(b.x + 8, b.y + b.height / 2, { steps: 6 });
  await page.mouse.move(b.x + b.width - 8, b.y + b.height / 2, { steps: 90 });
  await wait(page, 600);
}
