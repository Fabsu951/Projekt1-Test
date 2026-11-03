// Screen material for the November reels in MARKNADSPLAN-INSTAGRAM-FACEBOOK.md.
// N1 "Ni frågade: Norge finns nu på kartan": the hook card (the question, without
// a name), the map at Riksgränsen before (Norway empty) and now (Kartverket),
// the official slope map continuing into Norway (NVE), and the same thing done
// in the app's layer panel. Run by .github/workflows/november-klipp.yml; locally
// (map tiles stubbed), with vite preview running in "Svenska laviner/app":
//   cp klipp-lib.mjs november-klipp.mjs "../../app/scripts/" && STUB_TILES=1 node "../../app/scripts/november-klipp.mjs" out/
// ONLY=N1 records just those.
import {
  recorder, wait, tap, jump, tilesLoaded, cleanMap, SITE, W, H, offSeasonForecasts,
} from "./klipp-lib.mjs";

const rec = recorder(process.argv[2] ?? "klipp");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// Riksgränsen: the border runs through the middle of the view.
const BORDER = [68.428, 18.128];
const NORWAY = /cache\.kartverket\.no|gis3\.nve\.no/;
const SLOPE_LABEL = /^Lutning \(Naturvårdsverket/;

async function mapPage(fullscreen = false) {
  const page = await rec.open("/karta", { theme: "dark", forecasts: offSeasonForecasts });
  await wait(page, 2500); // the map page may still move itself once its data has loaded
  if (fullscreen) {
    await page.getByRole("button", { name: /Helskärm/ }).first().click();
    await wait(page, 800);
  }
  return page;
}
async function slopeOn(page) {
  await page.getByRole("button", { name: /^Kartlager/ }).click();
  await wait(page, 400);
  await page.getByLabel(SLOPE_LABEL).check();
  await page.getByRole("button", { name: /^Kartlager/ }).click();
}

const CLIPS = {
  N1: async () => {
    // The hook: the question as a message bubble, without name or picture.
    {
      const page = await rec.open("/om-appen", { theme: "dark", forecasts: offSeasonForecasts });
      const links = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join(""));
      await page.setContent(`<!doctype html><html data-theme="dark"><head><base href="${SITE}/"><meta charset="utf-8">${links}<style>
        html,body{margin:0;background:var(--bg)}
        .s{box-sizing:border-box;width:${W}px;height:${H}px;padding:0 26px;display:flex;flex-direction:column;justify-content:center;gap:18px;
          background:radial-gradient(120% 70% at 100% 0%, rgba(142,197,240,.16), transparent 60%), var(--bg);color:var(--text);font-family:var(--font-body)}
        .who{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--text-muted)}
        .dot{width:34px;height:34px;border-radius:50%;background:var(--bg-raised);border:1px solid var(--border)}
        .msg{background:var(--bg-raised);border:1px solid var(--border);border-radius:20px 20px 20px 6px;padding:16px 18px;font-size:19px;line-height:1.45}
        .ask{font:700 30px/1.15 var(--font-display);margin-top:8px}
        .ask span{color:var(--accent)}
      </style></head><body><div class="s">
        <div class="who"><div class="dot"></div>En skidåkare på Instagram</div>
        <div class="msg">"Det är inte helt ovanligt att man går en tur som korsar gränsen till Norge – på flera ställen."</div>
        <div class="ask">Ni frågade.<br><span>Här är svaret.</span></div>
      </div></body></html>`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await wait(page, 300);
      await rec.shot(page, "N1-1-krok");
      await page.context().close();
    }

    // Before and now: the same view at the border, first without Norway's maps.
    let before, now;
    {
      const page = await mapPage(true);
      await page.route(NORWAY, (r) => r.abort());
      await jump(page, BORDER, 12);
      await tilesLoaded(page);
      await wait(page, 1500);
      await cleanMap(page);
      before = await rec.shot(page, ".N1-fore");
      await page.context().close();
    }
    {
      const page = await mapPage(true);
      await jump(page, BORDER, 12);
      await tilesLoaded(page);
      await wait(page, 2500);
      const undo = await cleanMap(page);
      now = await rec.shot(page, "N1-2-nu");
      rec.fade("N1-2-fore-nu", before, now, 3);
      await undo();

      // The official slope map, Naturvårdsverket's in Sweden and NVE's in Norway.
      await jump(page, BORDER, 13);
      await tilesLoaded(page);
      await wait(page, 2500);
      const undo13 = await cleanMap(page);
      const topo13 = await rec.shot(page, ".N1-topo13");
      await undo13();
      await slopeOn(page);
      await jump(page, BORDER, 13);
      await tilesLoaded(page);
      await wait(page, 3500);
      await cleanMap(page);
      const slope = await rec.shot(page, "N1-3-lutning");
      rec.fade("N1-3-karta-lutning", topo13, slope, 3);
      await rec.zoomFrames(page, "N1-4-zoom-gransen", [68.44, 18.105], 14.3, 4);
      await page.context().close();
    }

    // The same in the app: Kartlager → Lutning, at the border.
    {
      const page = await mapPage();
      await jump(page, BORDER, 12.5);
      await tilesLoaded(page);
      await rec.record(page, "N1-5-i-appen", async () => {
        await wait(page, 1200);
        await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
        await wait(page, 900);
        const box = page.getByLabel(SLOPE_LABEL);
        await box.scrollIntoViewIfNeeded();
        await wait(page, 500);
        await tap(page, box);
        await wait(page, 900);
        await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
        await tilesLoaded(page);
        await wait(page, 3500);
      });
      await page.context().close();
    }
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
