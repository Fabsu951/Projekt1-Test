// Screen material for the November reels in MARKNADSPLAN-INSTAGRAM-FACEBOOK.md.
// N1 "Ni frågade: Norge finns nu på kartan": the hook card (the question, without
// a name), the map at Riksgränsen before (Norway empty) and now (Kartverket),
// the official slope map continuing into Norway (NVE), and the same thing done
// in the app's layer panel. Run by .github/workflows/november-klipp.yml; locally
// (map tiles stubbed), with vite preview running in "Svenska laviner/app":
//   cp klipp-lib.mjs november-klipp.mjs "../../app/scripts/" && STUB_TILES=1 node "../../app/scripts/november-klipp.mjs" out/
// H: covers and story pictures for the Instagram highlights (Börja här,
// Funktioner, Ni frågar, Gänget, Snöläget), with stills from earlier clips in
// ../kallor/ and fresh map shots.
// ONLY=N1 records just those.
import fs from "node:fs";
import path from "node:path";
import {
  recorder, wait, tap, jump, tilesLoaded, cleanMap, SITE, W, H, offSeasonForecasts, exampleForecasts,
} from "./klipp-lib.mjs";

const rec = recorder(process.argv[2] ?? "klipp");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// Riksgränsen: the border runs through the middle of the view.
const BORDER = [68.428, 18.128];
const NORWAY = /cache\.kartverket\.no|gis3\.nve\.no/;
const SLOPE_LABEL = /^Lutning \(Naturvårdsverket/;
// A transparent 1×1 PNG, so blocked tiles show nothing instead of a broken-image icon.
const EMPTY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=", "base64");

async function mapPage(fullscreen = false) {
  const page = await rec.open("/karta", { theme: "dark", forecasts: offSeasonForecasts });
  await wait(page, 2500); // the map page may still move itself once its data has loaded
  // On phones the map now opens in full screen by itself; only press the button when needed.
  const enter = page.getByRole("button", { name: "Helskärm", exact: true });
  if (fullscreen && (await enter.count())) {
    await enter.first().click();
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


// --- Highlights ------------------------------------------------------------------
const ICONS = {
  start: `<svg viewBox="0 0 32 32"><path d="M4 25 L13.2 8.5 L18 16.6 L20.6 12.6 L28 25 Z" fill="#fff"/><path d="M6.6 20.6 L11.4 18.4 L13.4 19.9 L17.6 17.4 L19.6 18.9 L25.2 16.8" fill="none" stroke="#1c5d99" stroke-width="1.7"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`,
  ask: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 4.5h16v11.5H10l-6 4.5z"/><path d="M10 8.6a2.1 2.1 0 1 1 3 1.9c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="14" r=".4" fill="#fff"/></svg>`,
  crew: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2"/><path d="M17.5 14.3c2.1.6 3.5 2.8 3.5 5.7"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.6 4.2 12 6.3l2.4-2.1M9.6 19.8 12 17.7l2.4 2.1M3.9 10.4l3.1.6-1-3M20.1 13.6l-3.1-.6 1 3M3.9 13.6l3.1-.6-1 3M20.1 10.4l-3.1.6 1-3"/></svg>`,
};
const COVERS = [["borja-har", "start"], ["funktioner", "map"], ["ni-fragar", "ask"], ["ganget", "crew"], ["snolaget", "snow"]];
// [file, kicker, title, text, picture (file) or icon name, note]
const STORIES = [
  ["borja-har-1", "Börja här", "Det här är Snöläge", "Lavinprognos, väder och karta med lutning för svenska fjällen – på ett ställe.", "start"],
  ["borja-har-2", "Dagens läge", "Prognosen för dina områden", "Farograd och lavinproblem från Naturvårdsverket, vind och väder från SMHI.", "start-shot"],
  ["borja-har-3", "Kartan", "Lutning i Sverige och Norge", "Lantmäteriets och Kartverkets kartor, med Naturvårdsverkets och NVE:s lutningskarta.", "N1-3-lutning"],
  ["borja-har-4", "Gratis", "Gratis och utan reklam", "Öppna snolage.se i webbläsaren. Appen för Android och iPhone kommer snart.", "start", "Ersätter inte lavinkurs eller egen bedömning."],
  ["borja-har-5", "Nedräkning", "Säsongspremiär 15 december", "Tryck på påminnelsen så får du en notis när det är dags.", "countdown"],
  ["funktioner-1", "Funktion", "Rita rutten", "Längd, höjdmeter, tid – och var rutten går över brant mark där dagens lavinproblem finns.", "A2-rutt"],
  ["funktioner-2", "Funktion", "Kartan utan täckning", "Spara kartan innan turen, så funkar den i flygplansläge.", "D4-offline"],
  ["funktioner-3", "Funktion", "Norge på kartan", "Kartverkets karta och NVE:s lutningskarta – turen kan gå över gränsen.", "N1-2-nu"],
  ["funktioner-4", "Funktion", "Hitta åk", "Välj lutning och väderstreck, så färgas terrängen som matchar.", "hitta-ak", "Visar terrängen, inte lavinfaran."],
  ["funktioner-5", "Funktion", "Planera turdagen", "Få en notis när prognosen för din dag kommer – och bjud med kompisarna.", "J1-turdag"],
  ["funktioner-6", "Funktion", "Snabbobservation", "Sprickor, wumpf eller snödrev? Tryck på det du ser – klart på tio sekunder.", "A4-snabbobs"],
  ["ni-fragar-1", "Ni frågar", "Snöläge svarar", "Ställ frågor och ge feedback. Alla har chans att påverka!", "ask"],
  ["ni-fragar-3", "Svar", "Nu finns Norge på kartan", "Och lutningskartan fortsätter över gränsen.", "N1-3-lutning"],
  ["ni-fragar-4", "Svar", "Nu finns Hitta åk", "Välj lutning och väderstreck – kartan färgar terrängen som matchar.", "N2-3-hitta-ak", "Visar terrängen, inte lavinfaran."],
  ["ganget-1", "Snöläge-gänget", "Åkare och guider som formar appen", "Snart presenterar vi dem här.", "crew"],
  ["ganget-2", "Snöläge-gänget", "Vill du vara med?", "Testa nya funktioner före alla andra och var med och forma Snöläge. Skicka ett DM!", "crew"],
  ["snolaget-1", "Snöläget", "Snöläget inför helgen", "Varje torsdag kväll från 17 december – bara publicerade prognoser från Naturvårdsverket.", "snow"],
];
const HL_CSS = `
  html,body{margin:0;background:var(--bg)}
  .c{box-sizing:border-box;width:${W}px;height:${H}px;padding:112px 26px 156px;display:flex;flex-direction:column;
    background:radial-gradient(120% 70% at 100% 0%, rgba(142,197,240,.16), transparent 60%), var(--bg);color:var(--text);font-family:var(--font-body)}
  .k{font:600 11px/1.2 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
  h1{font-family:var(--font-display);font-size:33px;line-height:1.06;margin:8px 0 10px;letter-spacing:-.01em}
  p{font-size:16px;line-height:1.45;color:var(--text-soft);margin:0}
  .pic{flex:1;min-height:0;margin-top:16px;border-radius:14px;overflow:hidden;border:1px solid var(--border)}
  .pic img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
  .ico{flex:1;display:grid;place-items:center}
  .ico div{width:150px;height:150px;border-radius:36px;background:#1c5d99;display:grid;place-items:center}
  .ico svg{width:96px;height:96px}
  .cd{flex:1;margin-top:16px;border:2px dashed var(--border);border-radius:14px}
  .note{margin-top:10px;font-size:12px;color:var(--text-muted)}
  .url{align-self:flex-start;margin-top:12px;background:var(--accent);color:var(--on-accent);border-radius:999px;padding:8px 16px;font:700 16px/1 var(--font-body)}
`;
async function highlights() {
  // Fresh shots: the start page with sample forecasts, and Hitta åk at Kebnekaise.
  const shots = {};
  {
    const page = await rec.open("/", { theme: "dark", label: "Exempelprognos" });
    await wait(page, 2500);
    shots["start-shot"] = await rec.shot(page, ".H-start");
    await page.context().close();
  }
  {
    const page = await mapPage(true);
    await page.getByRole("button", { name: /^Kartlager/ }).click();
    await wait(page, 400);
    await page.getByLabel(/^Hitta åk/).check();
    await page.getByRole("button", { name: /^Kartlager/ }).click();
    await jump(page, [67.905, 18.56], 13);
    await tilesLoaded(page);
    await wait(page, 4000);
    await cleanMap(page);
    shots["hitta-ak"] = await rec.shot(page, "H-hitta-ak");
    await page.context().close();
  }
  const src = (name) => shots[name] ?? [path.join(rec.OUT, `${name}.png`), path.join(rec.OUT, "..", "kallor", `${name}.png`)].find((f) => fs.existsSync(f));
  const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

  const page = await rec.open("/om-appen", { theme: "dark", forecasts: offSeasonForecasts });
  const links = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join(""));
  const render = async (name, body, css = HL_CSS) => {
    await page.setContent(`<!doctype html><html data-theme="dark"><head><base href="${SITE}/"><meta charset="utf-8">${links}<style>${css}</style></head><body>${body}</body></html>`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await wait(page, 200);
    await rec.shot(page, name);
  };
  for (const [name, icon] of COVERS) {
    await render(`H-omslag-${name}`, `<div style="width:${W}px;height:${H}px;background:#1c5d99;display:grid;place-items:center">` +
      `<div style="width:150px;height:150px">${ICONS[icon].replace("<svg ", '<svg width="150" height="150" ')}</div></div>`, "html,body{margin:0}");
  }
  for (const [name, kicker, title, text, visual, note] of STORIES) {
    const file = ICONS[visual] || visual === "countdown" ? null : src(visual);
    if (!ICONS[visual] && visual !== "countdown" && !file) { console.log("missing picture", visual); continue; }
    const pic = visual === "countdown" ? `<div class="cd"></div>`
      : ICONS[visual] ? `<div class="ico"><div>${ICONS[visual]}</div></div>`
      : `<div class="pic"><img src="${dataUrl(file)}"></div>`;
    const url = name === "borja-har-4" ? `<div class="url">snolage.se</div>` : "";
    await render(`H-${name}`, `<div class="c"><div class="k">${kicker}</div><h1>${title}</h1><p>${text}</p>${url}${pic}${note ? `<div class="note">${note}</div>` : ""}</div>`);
  }
  await page.context().close();
}

// The hook of a "Ni frågade" clip: the question as a message bubble, without name or picture.
async function quoteCard(name, who, quote) {
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
    <div class="who"><div class="dot"></div>${who}</div>
    <div class="msg">"${quote}"</div>
    <div class="ask">Ni frågade.<br><span>Här är svaret.</span></div>
  </div></body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await wait(page, 300);
  await rec.shot(page, name);
  await page.context().close();
}

// Hitta åk: opens the layer panel, turns the finder on and picks 20–30° facing NO, O and SO.
const KEB = [67.905, 18.56];
async function finderOn(page, show = false) {
  const go = show ? (l) => tap(page, l) : (l) => l.click();
  await go(page.getByRole("button", { name: /^Kartlager/ }));
  await wait(page, show ? 900 : 300);
  const box = page.getByLabel(/^Hitta åk/);
  await box.scrollIntoViewIfNeeded();
  await wait(page, show ? 500 : 100);
  await go(box);
  await wait(page, show ? 1200 : 300);
  const from = page.locator(".terrain-finder__field select").nth(0);
  await from.scrollIntoViewIfNeeded();
  await wait(page, show ? 400 : 50);
  await from.selectOption("20");
  await wait(page, show ? 900 : 50);
  await page.locator(".terrain-finder__field select").nth(1).selectOption("30");
  await wait(page, show ? 900 : 50);
  for (const dir of ["nordost", "öster", "sydost"]) {
    await go(page.getByRole("checkbox", { name: dir, exact: true }));
    await wait(page, show ? 700 : 50);
  }
  await wait(page, show ? 1200 : 200);
  await go(page.getByRole("button", { name: /^Kartlager/ }));
}

const CLIPS = {
  H: highlights,
  N1: async () => {
    await quoteCard("N1-1-krok", "En skidåkare på Instagram", "Det är inte helt ovanligt att man går en tur som korsar gränsen till Norge – på flera ställen.");

    // Before and now: the same view at the border, first without Norway's maps.
    let before, now;
    {
      const page = await mapPage(true);
      await page.route(NORWAY, (r) => r.fulfill({ status: 200, contentType: "image/png", body: EMPTY_PNG }));
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
      await rec.zoomFrames(page, "N1-4-zoom-gransen", [68.427, 18.108], 14.3, 4);
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
  S: async () => {
    // A plain screenshot of the slope map as users see it (UI visible), Kebnekaise.
    const page = await mapPage(true);
    await slopeOn(page);
    await jump(page, [67.905, 18.56], 13);
    await tilesLoaded(page);
    await wait(page, 4000);
    await rec.shot(page, "S-lutning-app");
    // With the layer panel open, so the legend shows.
    await page.getByRole("button", { name: /^Kartlager/ }).click();
    await wait(page, 600);
    const legend = page.locator(".official-terrain");
    await legend.scrollIntoViewIfNeeded().catch(() => {});
    await wait(page, 800);
    await rec.shot(page, "S-lutning-app-panel");
    await page.context().close();
  },
  N3: async () => {
    // "Skarpare fjällkarta": zoom 16 before (zoom 15 enlarged) and now, then the
    // official slope map (Naturvårdsverket, NVE in Norway). Kebnekaise's south top.
    const TOP = [67.9032, 18.5300];
    const Z16 = /\/topowebb\/16\//;
    let before;
    {
      const page = await mapPage(true);
      await page.route(Z16, (r) => r.fulfill({ status: 404, body: "" }));
      await jump(page, TOP, 16);
      await tilesLoaded(page);
      await wait(page, 3000);
      await cleanMap(page);
      before = await rec.shot(page, ".N3-fore");
      await page.context().close();
    }
    {
      const page = await mapPage(true);
      await jump(page, TOP, 16);
      await tilesLoaded(page);
      await wait(page, 3000);
      const undo = await cleanMap(page);
      const now = await rec.shot(page, "N3-nu");
      rec.fade("N3-2-fore-nu", before, now, 3);
      await undo();
      // The zoom in, from the whole massif to zoom 16.
      await jump(page, TOP, 12);
      await tilesLoaded(page);
      await wait(page, 2000);
      const undo2 = await cleanMap(page);
      await rec.zoomFrames(page, "N3-1-zoom", TOP, 16, 5);
      await undo2();
      // The official slope map at zoom 15.
      await jump(page, TOP, 15);
      await tilesLoaded(page);
      await wait(page, 2500);
      const undo3 = await cleanMap(page);
      const topo = await rec.shot(page, ".N3-topo15");
      await undo3();
      await slopeOn(page);
      await jump(page, TOP, 15);
      await tilesLoaded(page);
      await wait(page, 4000);
      await cleanMap(page);
      const slope = await rec.shot(page, "N3-lutning");
      rec.fade("N3-3-lutning", topo, slope, 3);
      await page.context().close();
    }
  },
  N2: async () => {
    await quoteCard("N2-1-krok", "En skidåkare i ett mejl", "Vore det inte coolt med en funktion där man kan välja spann på lutning och aspekt och exempelvis få ut allt som lutar 20–30 grader och ligger i aspekten NO till SO?");

    // In the app: Kartlager → Hitta åk → 20–30°, NO–SO.
    {
      const page = await mapPage();
      await jump(page, KEB, 13);
      await tilesLoaded(page);
      await rec.record(page, "N2-2-i-appen", async () => {
        await wait(page, 1000);
        await finderOn(page, true);
        await tilesLoaded(page);
        await wait(page, 3500);
      });
      await page.context().close();
    }

    // Full screen: the plain map fading into the matching terrain, then a zoom.
    {
      const page = await mapPage(true);
      await jump(page, KEB, 13);
      await tilesLoaded(page);
      await wait(page, 2500);
      const undo = await cleanMap(page);
      const topo = await rec.shot(page, ".N2-topo");
      await undo();
      await finderOn(page);
      await jump(page, KEB, 13);
      await tilesLoaded(page);
      await wait(page, 4000);
      await cleanMap(page);
      const found = await rec.shot(page, "N2-3-hitta-ak");
      rec.fade("N2-3-karta-hitta-ak", topo, found, 3);
      await rec.zoomFrames(page, "N2-4-zoom", KEB, 14.2, 4);
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
