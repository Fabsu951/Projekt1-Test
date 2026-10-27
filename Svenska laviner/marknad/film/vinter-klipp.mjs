// Screen material for the posts from November to January (SCHEMA-SOCIALA-MEDIER.md)
// that can be made before the season: three Instagram carousels (the six
// avalanche problems, warning signs, why 30° matters), stories ("snart" and the
// countdown), B5–B8 and the myth clips E1–E3, the welcome guide for A6, "spara
// kartan offline före resan" and "planera en turdag med kompisar". Anything
// with today's real forecast is made on the day instead. Run by
// .github/workflows/vinter-klipp.yml; locally (map tiles stubbed), with vite
// preview running in "Svenska laviner/app":
//   cp klipp-lib.mjs vinter-klipp.mjs "../../app/scripts/" && STUB_TILES=1 node "../../app/scripts/vinter-klipp.mjs" out/
// ONLY=K1,E2 records just those.
import fs from "node:fs";
import path from "node:path";
import {
  recorder, wait, scroll, tap, jump, tilesLoaded, button, cleanMap, findSteepSpot, SITE, W,
  offSeasonForecasts, STEEP_ROUTE, iso,
} from "./klipp-lib.mjs";

const rec = recorder(process.argv[2] ?? "klipp");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// --- Texts -------------------------------------------------------------------
// The avalanche problems' own descriptions and icons come from the app's safety
// guide; this advice is the app's PROBLEM_ADVICE (data/dangerAdvice.ts).
const PROBLEM_ADVICE = {
  "Nysnöflak": "Ge den nya snön ett till två dygn att sätta sig. Var försiktig där den ligger tjockt, särskilt i branta läsidor.",
  "Drevsnöflak": "Lär dig känna igen vindpackad snö: hård och kritaktig, ibland ihålig under skidorna, ofta under krön och i fördjupningar. Undvik branta läsidor där den har samlats.",
  "Bestående flak": "Svårt att upptäcka och kan utlösas på avstånd eller där snötäcket är tunt. Ha stora marginaler och välj måttligt brant terräng så länge problemet finns.",
  "Våta laviner": "Var ute tidigt medan snön är frusen och lämna branta sluttningar när snön blir blöt och du börjar sjunka in.",
  "Glidlaviner": "Håll dig undan från områden under glidsprickor och stanna aldrig under dem. Tidpunkten går inte att förutsäga.",
  "Hängdrivor": "Håll avstånd från krön, längre in än du tror, och vistas inte under stora hängdrivor.",
};
const SIGNS = [
  ["Färska laviner", "Laviner som gått i dag eller i går visar att snötäcket är instabilt just nu. I samma sorts terräng kan fler gå."],
  ["Skjutsprickor", "Sprickor som skjuter iväg från skidorna betyder att ett flak ligger på ett svagt lager och kan lossna."],
  ["Wumpf", "Ett dovt ljud när snötäcket sjunker ihop under dig: ett svagt lager kollapsar. Ett av de tydligaste varningstecknen."],
  ["Snödrev", "Vinden flyttar snö till läsidor och bygger nya drevsnöflak, ofta snabbt och mitt under dagen."],
  ["Mycket nysnö", "Mycket snö på kort tid, särskilt med vind, gör nysnöflak troliga tills snön har satt sig."],
  ["Värme eller regn", "Snabb uppvärmning och regn försvagar snötäcket och kan ge våta laviner, även utan att någon är där."],
];
const STEEP_BANDS = [
  ["Under 30°", "Flaklaviner är ovanligare. Men tänk på brantare terräng ovanför dig: laviner kan komma ner därifrån."],
  ["30–35°", "Här börjar flaklaviner bli möjliga. Vanlig terräng för skidåkning utanför pist."],
  ["35–45°", "Den branta terrängen där de flesta laviner som skidåkare själva löser ut går."],
  ["Över 45°", "Snön glider ofta av innan den hinner bygga upp spänning, men konsekvenserna av en lavin är extrema."],
];

// --- Slides --------------------------------------------------------------------
const css = `
  html,body{margin:0;background:var(--bg)}
  .slide{box-sizing:border-box;width:${W}px;height:var(--h);padding:30px 28px 22px;display:flex;flex-direction:column;position:relative;overflow:hidden;
    background:radial-gradient(120% 70% at 100% 0%, rgba(142,197,240,.16), transparent 60%), var(--bg);color:var(--text);font-family:var(--font-body)}
  .brand{display:flex;align-items:center;gap:8px;font:700 15px/1 var(--font-display);color:var(--text)}
  .brand svg{width:26px;height:26px}
  .kicker{margin-top:18px;font:600 11px/1.2 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
  h1{font-family:var(--font-display);font-size:36px;line-height:1.06;margin:10px 0 12px;letter-spacing:-.01em}
  .big h1{font-size:46px}
  .lead{font-size:17px;line-height:1.45;color:var(--text-soft);margin:0}
  .icon svg{width:76px;height:76px}
  .box{margin-top:auto;background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.45}
  .box strong{display:block;margin-bottom:4px;font-family:var(--font-display)}
  .bands{display:grid;gap:10px;margin-top:6px}
  .band{display:grid;grid-template-columns:96px 1fr;gap:12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:11px 14px;font-size:13.5px;line-height:1.4}
  .band b{font:700 19px/1.2 var(--font-display)}
  .shot{margin-top:auto;border-radius:14px;overflow:hidden;border:1px solid var(--border)}
  .shot img{display:block;width:100%}
  .foot{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:11px;color:var(--text-muted)}
  .cta{margin-top:auto;font:700 26px/1.2 var(--font-display)}
  .cta span{color:var(--accent)}
`;
async function slideDeck(name, height, build) {
  const page = await rec.open("/sakerhetsguide", { theme: "dark", forecasts: offSeasonForecasts, height });
  await wait(page, 1500);
  const app = await page.evaluate(() => ({
    links: [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join(""),
    brand: document.querySelector('header a[href="/"] svg')?.outerHTML ?? "",
    problems: [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Lavinproblemen")?.closest("section")
      ?.querySelectorAll(".avalanche-problems__item")
      ? [...[...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Lavinproblemen").closest("section").querySelectorAll(".avalanche-problems__item")]
          .map((el) => ({ icon: el.querySelector("svg")?.outerHTML ?? "", name: el.querySelector("strong")?.textContent ?? "", text: el.querySelector("p")?.textContent ?? "" }))
      : [],
  }));
  const slides = await build(app, page);
  for (const [i, body] of slides.entries()) {
    await page.setContent(`<!doctype html><html data-theme="dark"><head><base href="${SITE}/"><meta charset="utf-8">${app.links}<style>${css}</style></head>` +
      `<body><div class="slide" style="--h:${height}px"><div class="brand">${app.brand}Snöläge</div>${body}</div></body></html>`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await wait(page, 300);
    await rec.shot(page, `${name}-${i + 1}`);
  }
  await page.context().close();
}
const foot = (left, right) => `<div class="foot"><span>${left}</span><span>${right}</span></div>`;
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

const CLIPS = {
  // Carousel "De sex lavinproblemen" (1080×1350): cover, one slide per problem, end.
  K1: () => slideDeck("K1-lavinproblem", 540, (app) => {
    const n = app.problems.length + 2;
    return [
      `<div class="kicker">Lär dig på en minut</div><div class="big"><h1>De sex lavinproblemen</h1></div>
       <p class="lead">Varje lavinprognos beskriver faran med ett eller flera av dem. Varje problem har sina egna platser i terrängen och sitt eget sätt att undvikas.</p>
       <div class="box"><strong>Svep för att lära dig alla sex</strong>Samma namn som i Naturvårdsverkets prognoser.</div>${foot(`1/${n}`, "Källa: lavinprognoser.se, EAWS")}`,
      ...app.problems.map((p, i) => `<div class="kicker">Lavinproblem ${i + 1} av ${app.problems.length}</div>
       <div class="icon" style="margin-top:12px">${p.icon}</div><h1>${p.name}</h1><p class="lead">${p.text}</p>
       <div class="box"><strong>Så hanterar du det</strong>${PROBLEM_ADVICE[p.name] ?? ""}</div>${foot(`${i + 2}/${n}`, "Källa: lavinprognoser.se, EAWS")}`),
      `<div class="kicker">Dagens läge</div><h1>Vilket problem gäller i dag?</h1>
       <p class="lead">Prognosen säger vilket lavinproblem som finns, var i terrängen och hur lätt det är att utlösa. Läs alltid hela prognosen, och gå en lavinkurs.</p>
       <div class="cta">Dagens lavinproblem för de svenska fjällen finns i Snöläge.<br><span>snolage.se</span></div>${foot(`${n}/${n}`, "Gratis och utan reklam")}`,
    ];
  }),

  // Carousel "Varningstecken": cover, one slide per sign, end.
  K2: () => slideDeck("K2-varningstecken", 540, () => {
    const n = SIGNS.length + 2;
    return [
      `<div class="kicker">Lär dig på en minut</div><div class="big"><h1>Sex varnings&shy;tecken i fjället</h1></div>
       <p class="lead">Snötäcket säger ofta ifrån innan det släpper. Ser eller hör du något av de här är snötäcket instabilt just nu.</p>
       <div class="box"><strong>Svep för alla sex</strong>Ser du ett varningstecken: välj flackare terräng, och lägg gärna in en observation.</div>${foot(`1/${n}`, "Källa: lavinprognoser.se, EAWS")}`,
      ...SIGNS.map(([name, text], i) => `<div class="kicker">Varningstecken ${i + 1} av ${SIGNS.length}</div><h1>${name}</h1><p class="lead">${text}</p>
       <div class="box"><strong>Vad gör jag?</strong>Undvik branta sluttningar och sluttningar under dem. Hellre en flack tur i dag än en tur för mycket.</div>${foot(`${i + 2}/${n}`, "Källa: lavinprognoser.se, EAWS")}`),
      `<div class="kicker">Dela det du ser</div><h1>Såg du ett varningstecken?</h1>
       <p class="lead">Med Snabbobservation i Snöläge tar det tio sekunder: tryck på det du ser, platsen tas från telefonen. Andra åkare ser det direkt.</p>
       <div class="cta">Gratis på <span>snolage.se</span></div>${foot(`${n}/${n}`, "Ersätter inte lavinkurs eller egen bedömning")}`,
    ];
  }),

  // Carousel "Därför är 30 grader viktigt", with Naturvårdsverket's slope map from the app.
  K3: async () => {
    const page = await rec.open("/karta", { forecasts: offSeasonForecasts });
    await tap(page, button(page, "Helskärm"));
    await page.evaluate(() => { window.__map.options.zoomSnap = 0.25; });
    await jump(page, [67.918, 18.505], 13.5);
    await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
    await wait(page, 800);
    const box = page.getByRole("checkbox", { name: "Lutning", exact: true });
    await box.scrollIntoViewIfNeeded();
    await tap(page, box);
    await wait(page, 2500);
    const legend = await rec.shot(page, "K3-teckenforklaring", page.locator(".official-terrain img").first()).catch(() => null);
    await page.evaluate(() => document.querySelector(".map-toolbar__layers").click());
    const undo = await cleanMap(page);
    await tilesLoaded(page);
    await wait(page, 2500);
    const map = await rec.shot(page, "K3-lutningskarta");
    await undo();
    await page.context().close();
    return slideDeck("K3-30-grader", 540, () => [
      `<div class="kicker">Lär dig på en minut</div><div class="big"><h1>30 grader.</h1></div>
       <p class="lead">Därför är det siffran som spelar roll när du åker utanför pisten.</p>
       <div class="box"><strong>De flesta flaklaviner som skidåkare löser ut går i terräng brantare än 30°.</strong>Svep för att se varför, och hur du hittar de branta sluttningarna.</div>${foot("1/5", "Källa: Fjällsäkerhetsrådet, lavinprognoser.se")}`,
      `<div class="kicker">Brantheten och lavinerna</div><h1>Hur brant är brant?</h1>
       <div class="bands">${STEEP_BANDS.map(([r, t]) => `<div class="band"><b>${r}</b><span>${t}</span></div>`).join("")}</div>${foot("2/5", "Källa: Fjällsäkerhetsrådet")}`,
      `<div class="kicker">Så ser det ut på kartan</div><h1>Lutningen i färg</h1>
       <p class="lead">Grönt från 25°, gult från 30°, orange och rött brantare än så. Naturvårdsverkets lutningskarta, i Snöläge.</p>
       <div class="shot"><img src="${dataUrl(map)}" style="height:300px;object-fit:cover;object-position:center"></div>${foot("3/5", "Karta: ©Lantmäteriet · Lutning: Naturvårdsverket")}`,
      `<div class="kicker">Viktigt</div><h1>Lutningen visar terrängen, inte lavinfaran.</h1>
       <p class="lead">En sluttning under 30° kan ligga under en brant sida där laviner går. Läs alltid dagens prognos, och kolla vad som finns ovanför dig.</p>
       ${legend ? `<div class="shot" style="background:#fff;padding:10px 16px"><img src="${dataUrl(legend)}" style="width:62%"></div>` : ""}${foot("4/5", "Teckenförklaring: Naturvårdsverket")}`,
      `<div class="kicker">I appen</div><h1>Karta → Kartlager → Lutning</h1>
       <p class="lead">Lantmäteriets karta med lutning, dagens lavinprognos och ruttplanering som visar var rutten går i brant terräng.</p>
       <div class="cta">Gratis på <span>snolage.se</span></div>${foot("5/5", "Ersätter inte lavinkurs eller egen bedömning")}`,
    ]);
  },

  // Stories (1080×1920): "Snart" and the countdown, with today's start page.
  S: async () => {
    const page = await rec.open("/", { theme: "dark", forecasts: offSeasonForecasts });
    const start = await rec.shot(page, ".S-startsida");
    await page.context().close();
    const phone = `<div class="shot" style="margin:22px auto 0;width:72%;border-radius:22px;border-width:3px"><img src="${dataUrl(start)}"></div>`;
    const stories = [
      ["S1-snart", "Snart", "Lavinsäsongen börjar snart. Det gör Snöläge också.", "Lavinprognos, väder och karta med lutning för svenska fjällen – på ett ställe."],
      ["S2-10-dagar", "Nedräkning", "10 dagar kvar till säsongens första lavinprognos", "Stjärnmärk dina områden och slå på notiser, så får du första prognosen direkt."],
      ["S3-7-dagar", "Nedräkning", "7 dagar kvar", "Stjärnmärk dina områden och slå på notiser, så får du första prognosen direkt."],
      ["S4-3-dagar", "Nedräkning", "3 dagar kvar", "Har du slagit på notiserna? Då får du veta när farograden publiceras i dina områden."],
      ["S5-i-morgon", "I morgon", "I morgon kommer första prognosen. Då lanseras Snöläge.", "Gratis och utan reklam."],
    ];
    const deck = stories.map(([, kicker, title, lead]) => `<div class="kicker">${kicker}</div><div class="big"><h1>${title}</h1></div><p class="lead">${lead}</p>${phone}<div class="cta" style="text-align:center;margin-top:18px"><span>snolage.se</span></div>`);
    await slideDeck("S", 768, () => deck);
    stories.forEach(([file], i) => fs.renameSync(path.join(rec.OUT, `S-${i + 1}.png`), path.join(rec.OUT, `${file}.png`)));
    fs.rmSync(start);
  },

  // B5–B7 pictures and B8 "Varningstecken": tapping through the quick observation buttons.
  B: async () => {
    const guide = await rec.open("/sakerhetsguide", { theme: "dark" });
    for (const [name, title] of [["B5-vata-laviner", "Våta laviner"], ["B6-glidlaviner", "Glidlaviner"], ["B7-hangdrivor", "Hängdrivor"]]) {
      const item = guide.locator(".avalanche-problems__item", { hasText: title }).last();
      if (await item.count()) await rec.shot(guide, name, item);
    }
    await guide.context().close();
    const page = await rec.open("/observationer/snabb");
    await rec.record(page, "B8-varningstecken", async () => {
      await wait(page, 1000);
      for (const sign of ["Färsk lavin", "Skjutsprickor", "Wumpf / kollaps", "Snödrev", "Mycket nysnö", "Värme eller regn"]) {
        await tap(page, page.getByRole("button", { name: sign }));
        await wait(page, 1300);
      }
      await wait(page, 1500);
    });
    await page.context().close();
  },

  // E1 "Myt: i skogen är det inga laviner": steep ground below the treeline near Åre.
  E1: async () => {
    const page = await rec.open("/karta", { forecasts: offSeasonForecasts });
    const spot = (await findSteepSpot(page, { box: [63.36, 12.85, 63.46, 13.2], target: 36, tol: 3, minH: 420, maxH: 720 }))
      ?? { lat: 63.418, lon: 13.06, slope: null, height: null };
    console.log("E1 spot:", JSON.stringify(spot));
    await tap(page, button(page, "Helskärm"));
    await jump(page, [63.41, 13.05], 10.5);
    await tilesLoaded(page);
    const a = await rec.record(page, ".E1a", async () => {
      await wait(page, 800);
      await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
      await wait(page, 800);
      const box = page.getByRole("checkbox", { name: "Lutning", exact: true });
      await box.scrollIntoViewIfNeeded();
      await tap(page, box);
      await wait(page, 1200);
      await page.evaluate(() => document.querySelector(".map-toolbar__layers").click());
      await wait(page, 1200);
    });
    const b = await rec.zoomFrames(page, ".E1b", [spot.lat, spot.lon], 14.5, 6);
    rec.join("E1-myt-skogen", [a, b, await rec.hold(page, ".E1c", 2.5)]);
    fs.writeFileSync(path.join(rec.OUT, "E1-plats.txt"), spot.slope
      ? `Klippet zoomar in mot ${spot.lat.toFixed(4)}, ${spot.lon.toFixed(4)} nära Åre, ca ${Math.round(spot.height)} m ö.h. (under trädgränsen), lutning ca ${spot.slope.toFixed(0)}°.\n`
      : "Ingen brant skogssluttning kunde räknas fram den här gången; klippet zoomar in mot Åreskutans nedre sluttningar.\n");
    await page.context().close();
  },

  // E2 "Myt: har någon åkt där är det lugnt": the tour heat map over steep ground.
  E2: async () => {
    const lines = Array.from({ length: 16 }, (_, k) => ({
      id: 100 + k, title: `Tur ${k + 1}`, startedAt: iso(-24 * (k + 2)),
      points: STEEP_ROUTE.map(([lat, lon], i) => [lat + Math.sin(k * 1.7 + i) * 0.0009, lon + Math.cos(k * 2.3 + i) * 0.0016]),
    }));
    const page = await rec.open("/karta", { forecasts: offSeasonForecasts, label: "Exempeldata", extra: (req) => new URL(req.url()).pathname === "/tours/lines" ? { json: { lines } } : null });
    await tap(page, button(page, "Helskärm"));
    await page.evaluate((pts) => window.__map.fitBounds(pts, { padding: [60, 60], animate: false }), STEEP_ROUTE);
    await page.evaluate(() => window.__map.setZoom(window.__map.getZoom() - 2, { animate: false }));
    await tilesLoaded(page);
    const a = await rec.record(page, ".E2a", async () => {
      await wait(page, 800);
      await tap(page, page.getByRole("button", { name: /^Kartlager/ }));
      await wait(page, 800);
      await tap(page, page.getByRole("checkbox", { name: /Värmekarta över turer/ }));
      await wait(page, 1000);
      const box = page.getByRole("checkbox", { name: "Lutning", exact: true });
      await box.scrollIntoViewIfNeeded();
      await tap(page, box);
      await wait(page, 1200);
      await page.evaluate(() => document.querySelector(".map-toolbar__layers").click());
      await wait(page, 1500);
    });
    const b = await rec.zoomFrames(page, ".E2b", STEEP_ROUTE[5], 14, 5);
    rec.join("E2-myt-spar", [a, b, await rec.hold(page, ".E2c", 2.5)]);
    await page.context().close();
  },

  // E3 "Myt: låg farograd = inget att tänka på": what level 2 means, from the area page.
  E3: async () => {
    const page = await rec.open("/omrade/sodra-jamtlandsfjallen", { theme: "dark", label: "Exempelprognos" });
    await rec.record(page, "E3-myt-lag-farograd", async () => {
      await wait(page, 1800);
      await scroll(page, 260, 1600);
      await wait(page, 1200);
      const advice = page.getByText("Vad betyder det för mig?").first();
      const dy = await advice.evaluate((el) => el.getBoundingClientRect().top - 110).catch(() => 300);
      await scroll(page, dy, 2200);
      await wait(page, 4000);
      await scroll(page, 320, 2500);
      await wait(page, 2500);
    });
    await page.context().close();
  },

  // A6 nedräkning: the welcome guide on a first visit – pick your areas. (The
  // notification step can't be shown here: the recording browser has no push.)
  A6: async () => {
    const page = await rec.open("/", { theme: "dark", forecasts: offSeasonForecasts, fresh: true });
    await wait(page, 1000);
    await rec.record(page, "A6-valkomstguide", async () => {
      await wait(page, 1800);
      await tap(page, page.getByRole("button", { name: "Kom igång" }));
      await wait(page, 1500);
      for (const area of ["Kebnekaisefjällen", "Södra Jämtlandsfjällen"]) {
        const choice = page.getByRole("checkbox", { name: new RegExp(area) }).or(page.getByRole("button", { name: new RegExp(area) })).first();
        await tap(page, choice).catch((e) => console.log("A6:", area, e.message));
        await wait(page, 900);
      }
      await wait(page, 2500);
    });
    await page.context().close();
  },

  // "Spara kartan offline före resan" (launch week day 4 and before Christmas).
  D4: async () => {
    const page = await rec.open("/omrade/kebnekaisefjallen", { theme: "dark", forecasts: offSeasonForecasts });
    await rec.record(page, "D4-spara-kartan-offline", async () => {
      await wait(page, 1200);
      const toggle = page.getByRole("button", { name: /^Karta offline/ });
      const dy = await toggle.evaluate((el) => el.getBoundingClientRect().top - 140);
      await scroll(page, dy, 3000);
      await wait(page, 600);
      await tap(page, toggle);
      await wait(page, 1200);
      await tap(page, page.getByRole("button", { name: /^Översikt/ }));
      await page.waitForFunction(() => !/Sparar kartan…/.test(document.body.innerText), null, { timeout: 120_000 }).catch(() => console.log("D4: still saving"));
      await wait(page, 2500);
    });
    await page.context().close();
  },

  // "Så planerar du en turdag med kompisar": pick a day, compare a route, invite friends.
  J1: async () => {
    const friends = [{ id: 2, displayName: "Erik Holm", avatarPath: null, xp: 1650, isAdmin: false }, { id: 3, displayName: "Sara Berg", avatarPath: null, xp: 820, isAdmin: false }];
    let trip = null;
    const extra = (req) => {
      const p = new URL(req.url()).pathname, m = req.method();
      if (p === "/trips" && m === "GET") return { json: { trips: trip ? [trip] : [], invitations: [] } };
      if (p === "/trips" && m === "POST") {
        const body = req.postDataJSON() ?? {};
        trip = { id: 7, regionId: body.regionId, date: body.date, notified: false, routeId: body.routeId ?? null,
          routeTitle: body.routeId ? "Tarfala – Kebnekaise" : null, invites: trip?.invites ?? [], company: [] };
        return { json: { trip } };
      }
      if (/^\/trips\/\d+$/.test(p) && m === "DELETE") { trip = null; return { json: { ok: true } }; }
      if (/^\/trips\/\d+\/invites$/.test(p)) {
        const ids = req.postDataJSON()?.userIds ?? [];
        trip.invites = friends.filter((f) => ids.includes(f.id)).map((f, i) => ({ id: 20 + i, user: { id: f.id, displayName: f.displayName }, status: "pending" }));
        return { json: { invites: trip.invites } };
      }
      if (p === "/people/me/follows") return { json: { following: friends, followers: friends } };
      return null;
    };
    const page = await rec.open("/omrade/kebnekaisefjallen", { theme: "dark", forecasts: offSeasonForecasts, label: "Exempeldata", extra });
    await rec.record(page, "J1-turdag-med-kompisar", async () => {
      await wait(page, 1200);
      await tap(page, page.locator(".jump-nav a", { hasText: "Turdag" }));
      await wait(page, 1800);
      await tap(page, page.getByRole("group", { name: "Dag för turen" }).getByRole("button").nth(1));
      await wait(page, 2000);
      const select = page.locator(".trip-plan__route select");
      if (await select.count()) {
        await tap(page, select);
        await select.selectOption({ label: "Tarfala – Kebnekaise" });
        await wait(page, 4000);
      } else console.log("J1: no route choice");
      const invite = page.getByRole("button", { name: "Bjud in kompisar" });
      await invite.scrollIntoViewIfNeeded();
      await wait(page, 500);
      await tap(page, invite);
      await wait(page, 1200);
      for (const f of friends) {
        await tap(page, page.getByRole("checkbox", { name: new RegExp(f.displayName) })).catch((e) => console.log("J1:", e.message));
        await wait(page, 600);
      }
      await tap(page, page.getByRole("button", { name: "Skicka inbjudan" }));
      await wait(page, 3500);
    });
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
