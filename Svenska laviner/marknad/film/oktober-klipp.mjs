// Screen material for the clips to film in October (SCHEMA-SOCIALA-MEDIER.md):
// A2 ruttkollen, A3 offline, A4 snabbobservation, B1–B4 (lavinskalan and
// three avalanche problems), F1 the Snöläge part of "3 appar → 1", F2 "gissa
// lutningen", F3 "min koll före turen". Run by .github/workflows/oktober-klipp.yml;
// locally (map tiles stubbed), with vite preview running in "Svenska laviner/app":
//   cp klipp-lib.mjs oktober-klipp.mjs "../../app/scripts/" && STUB_TILES=1 node "../../app/scripts/oktober-klipp.mjs" out/
// ONLY=A2,F2 records just those.
import fs from "node:fs";
import path from "node:path";
import {
  recorder, wait, scroll, scrollTo, tap, jump, tilesLoaded, button, cleanMap, drawRoute, followProfile,
  exampleForecasts, routeCheckForecasts, offSeasonForecasts, STEEP_ROUTE,
} from "./klipp-lib.mjs";

const rec = recorder(process.argv[2] ?? "klipp");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const KEBNEKAISE = [67.9, 18.55];
const EXAMPLE = "Exempelprognos";

// Opens the route planner in full screen with `points` framed above the route panel.
async function plannerWith(page, points) {
  await tap(page, button(page, "Helskärm"));
  await wait(page, 600);
  await tap(page, button(page, "Planera rutt"));
  await wait(page, 1000);
  await page.evaluate((pts) => {
    window.__map.options.zoomSnap = 0.25;
    window.__map.fitBounds(pts, { paddingTopLeft: [40, 110], paddingBottomRight: [40, 768 * 0.45 + 40], animate: false });
  }, points);
  await tilesLoaded(page);
  await wait(page, 1500);
}

// Finds a slope of about 37° (inside the 35–40° band) near Kebnekaise from the
// same ~30 m height data the app uses (Mapterhorn), where the ground around is
// about as steep, so the answer does not depend on hitting one exact pixel.
const findSlope = (page) => page.evaluate(async () => {
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
  let best = null;
  for (let lat = 67.875; lat <= 67.93; lat += 0.0015) {
    for (let lon = 18.47; lon <= 18.66; lon += 0.004) {
      const s = await slope(lat, lon);
      if (Math.abs(s - 37.5) > 1.5) continue;
      const h = await height(lat, lon);
      if (h < 1000) continue;
      const d = 120 / 111320, dl = 120 / (111320 * Math.cos((lat * Math.PI) / 180));
      const around = await Promise.all([slope(lat + d, lon), slope(lat - d, lon), slope(lat, lon + dl), slope(lat, lon - dl)]);
      const spread = Math.max(...around.map((a) => Math.abs(a - s)));
      if (!best || spread < best.spread) best = { lat, lon, slope: s, height: h, spread };
    }
  }
  return best;
}).catch((e) => (console.log("slope search failed", e.message), null));

const CLIPS = {
  // A2 "Så funkar ruttkollen": draw a route over steep ground, the profile, then the comparison with the forecast.
  A2: async () => {
    const page = await rec.open("/karta", { forecasts: routeCheckForecasts, label: EXAMPLE });
    await plannerWith(page, STEEP_ROUTE);
    await rec.record(page, "A2-ruttkollen", async () => {
      await wait(page, 1000);
      await drawRoute(page, STEEP_ROUTE);
      await wait(page, 3000);
      await followProfile(page);
      const check = page.locator(".route-forecast").first();
      if (await check.count()) {
        await check.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
        await wait(page, 4000);
        console.log("A2 route check:", (await check.innerText()).replace(/\s+/g, " "));
      } else console.log("A2: no route check found");
      await wait(page, 1500);
    });
    await page.context().close();
  },

  // A3 "Kartan funkar utan täckning": save what is on screen, go offline, the map still works.
  A3: async () => {
    const page = await rec.open("/karta", { forecasts: offSeasonForecasts });
    await jump(page, KEBNEKAISE, 12);
    await tilesLoaded(page);
    const a = await rec.record(page, ".A3a", async () => {
      await wait(page, 1000);
      await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
      await wait(page, 900);
      const save = button(page, "Spara det som syns offline");
      await save.scrollIntoViewIfNeeded();
      await wait(page, 500);
      await tap(page, save);
      await page.waitForFunction(() => !document.querySelector('progress[aria-label="Sparar kartan"]'), null, { timeout: 120_000 })
        .catch(() => console.log("A3: still saving"));
      await wait(page, 1500);
      // The open panel covers its own button on a phone, so close it directly.
      await page.evaluate(() => document.querySelector(".map-toolbar__layers").click());
      await wait(page, 500);
      await scroll(page, -2000, 900);
      await wait(page, 800);
      await page.context().setOffline(true);
      await wait(page, 2500); // the "no coverage" banner
    });
    const b = await rec.zoomFrames(page, ".A3b", KEBNEKAISE, 13.5, 4);
    rec.join("A3-offline", [a, b, await rec.hold(page, ".A3c", 2)]);
    await page.context().close();
  },

  // A4 "Snabbobservation på tio sekunder".
  A4: async () => {
    const page = await rec.open("/observationer/snabb", { label: "Exempeldata" });
    await wait(page, 1500);
    await rec.record(page, "A4-snabbobservation", async () => {
      await wait(page, 1000);
      await tap(page, page.getByRole("button", { name: "Skjutsprickor" }));
      await wait(page, 600);
      await tap(page, page.getByRole("button", { name: "Snödrev" }));
      await wait(page, 600);
      const note = page.locator("textarea, input[type=text]").first();
      await tap(page, note);
      await note.pressSequentially("Nordostsluttning ovanför Tarfala, ca 1300 m", { delay: 45 });
      await wait(page, 800);
      await page.keyboard.press("Tab").catch(() => {});
      const send = page.getByRole("button", { name: "Skicka observationen" });
      await send.scrollIntoViewIfNeeded();
      await wait(page, 600);
      await tap(page, send);
      await wait(page, 3500);
    });
    await page.context().close();
  },

  // B1 lavinskalan and B2–B4 the avalanche problems, from the safety guide (no forecast shown).
  B: async () => {
    const page = await rec.open("/sakerhetsguide", { theme: "dark" });
    await rec.shot(page, "B1-lavinskalan", page.locator(".danger-scale-guide").first());
    for (const [name, title] of [["B2-nysnoflak", "Nysnöflak"], ["B3-drevsnoflak", "Drevsnöflak"], ["B4-bestaende-flak", "Bestående flak"]]) {
      const item = page.locator(".avalanche-problems__item", { hasText: title }).first();
      if (await item.count()) await rec.shot(page, name, item);
      else console.log(`B: no card for ${title}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(page, 800);
    await rec.record(page, "B1-lavinskalan", async () => {
      await scrollTo(page, ".danger-scale-guide", 2500, 90);
      await wait(page, 1500);
      await scroll(page, 380, 6000);
      await wait(page, 1500);
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(page, 800);
    await rec.record(page, "B2-B4-lavinproblemen", async () => {
      await scrollTo(page, ".avalanche-problems", 2500, 90);
      await wait(page, 1500);
      await scroll(page, 1400, 14000);
      await wait(page, 1000);
    });
    await page.context().close();
  },

  // F1, the Snöläge half of "3 appar → 1": forecast, weather and map in one app.
  F1: async () => {
    const page = await rec.open("/", { theme: "dark", label: EXAMPLE });
    const a = await rec.record(page, ".F1a", async () => {
      await wait(page, 1200);
      await tap(page, page.locator('a[href="/omrade/kebnekaisefjallen"]').first());
      await wait(page, 1800);
      await scroll(page, 300, 1200);
      await wait(page, 600);
      await tap(page, page.locator(".jump-nav a", { hasText: "Väder" }));
      await wait(page, 2000);
      await tap(page, page.locator(".tab-bar a", { hasText: "Karta" }));
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(page, 1500);
    });
    // The map page may still move itself once its data has loaded; jump after that.
    await wait(page, 2500);
    await jump(page, KEBNEKAISE, 12);
    await tilesLoaded(page);
    const b = await rec.record(page, ".F1b", async () => {
      await wait(page, 600);
      await tap(page, page.getByRole("button", { name: /^Planera tur/ }));
      await tilesLoaded(page);
      await wait(page, 2500);
    });
    rec.join("F1-snolage", [a, b]);
    await page.context().close();
  },

  // F2 "Gissa lutningen": the question (map without slope, a ring on the slope) and the answer.
  F2: async () => {
    const page = await rec.open("/karta", { forecasts: offSeasonForecasts });
    const found = await findSlope(page);
    const spot = found ?? { lat: 67.9055, lon: 18.585, slope: null, height: null };
    console.log("F2 spot:", JSON.stringify(spot));
    await tap(page, button(page, "Helskärm"));
    await wait(page, 600);
    await page.evaluate(() => { window.__map.options.zoomSnap = 0.25; });
    await jump(page, [spot.lat, spot.lon], 14.5);
    await tilesLoaded(page);
    await page.evaluate(() => {
      const ring = document.createElement("div");
      ring.className = "clip-ring";
      ring.style.cssText = "position:fixed;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 3px rgba(0,0,0,.55);pointer-events:none;z-index:99997";
      document.body.appendChild(ring);
    });
    let undo = await cleanMap(page);
    await wait(page, 800);
    const question = await rec.shot(page, "F2-fraga");
    await undo();
    await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
    await wait(page, 900);
    const slopeBox = page.getByRole("checkbox", { name: "Lutning", exact: true });
    await slopeBox.scrollIntoViewIfNeeded();
    await tap(page, slopeBox);
    await wait(page, 2500);
    const legend = page.locator(".official-terrain img").first();
    if (await legend.count()) await rec.shot(page, "F2-teckenforklaring", legend);
    await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
    await wait(page, 800);
    undo = await cleanMap(page);
    await tilesLoaded(page);
    await wait(page, 2500);
    const answer = await rec.shot(page, "F2-svar");
    rec.fade("F2-svar", question, answer);
    fs.writeFileSync(path.join(rec.OUT, "F2-svar.txt"), found
      ? `Punkten i ringen: ${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)}, ca ${Math.round(spot.height)} m ö.h.\n` +
        `Lutning ca ${spot.slope.toFixed(1)}° (beräknad från ~30 m höjddata, samma som appens ruttplanering).\n` +
        `Rätt svar: 35–40°. Naturvårdsverkets lutningskarta i F2-svar.png visar det med färg (se F2-teckenforklaring.png).\n`
      : "Ingen lutning kunde beräknas den här gången. Läs av färgen i F2-svar.png mot F2-teckenforklaring.png innan du publicerar.\n");
    await page.context().close();
  },

  // F3 "Min koll före turen på 20 sekunder": forecast, weather, the saved route.
  F3: async () => {
    const page = await rec.open("/", { theme: "dark", forecasts: routeCheckForecasts, label: EXAMPLE });
    const a = await rec.record(page, ".F3a", async () => {
      await wait(page, 1200);
      await tap(page, page.locator('a[href="/omrade/kebnekaisefjallen"]').first());
      await wait(page, 2200);
      await tap(page, page.locator(".jump-nav a", { hasText: "Lavinproblem" }));
      await wait(page, 2000);
      await tap(page, page.locator(".jump-nav a", { hasText: "Väder" }));
      await wait(page, 2200);
    });
    await page.goto(`${process.env.SITE ?? "http://localhost:4173"}/karta?rutt=3`, { waitUntil: "networkidle" }).catch(() => {});
    await wait(page, 1500);
    await tap(page, button(page, "Helskärm"));
    await tilesLoaded(page);
    await wait(page, 4000);
    const b = await rec.record(page, ".F3b", async () => {
      await wait(page, 1500);
      const check = page.locator(".route-forecast").first();
      if (await check.count()) await check.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
      await wait(page, 3500);
    });
    rec.join("F3-min-koll", [a, b]);
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
await rec.close();
