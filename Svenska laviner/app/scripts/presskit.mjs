// Makes the press kit in public/presskit (shown on /press): the logo for light
// and dark backgrounds rendered with the app's own font, the mark as SVG, the
// app icon and the store screenshots (Svenska laviner/app-store) as JPEG plus
// small WebP previews. Run from Svenska laviner/app after new screenshots:
//   npm install --no-save playwright@1.55.0 && node scripts/presskit.mjs
// (Chromium: set PLAYWRIGHT_CHROMIUM or let Playwright find its own.)
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const sharp = createRequire(import.meta.url)("sharp");
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const APP = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const OUT = `${APP}/public/presskit`;
const STORE = `${APP}/../app-store`;
mkdirSync(OUT, { recursive: true });
const fontDir = `${APP}/node_modules/@fontsource-variable/instrument-sans/files`;
const woff = readFileSync(`${fontDir}/instrument-sans-latin-wdth-normal.woff2`).toString("base64");
const mark = (accent, on) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${accent}"/><path d="M4 25 L13.2 8.5 L18 16.6 L20.6 12.6 L28 25 Z" fill="${on}"/><path d="M6.6 20.6 L11.4 18.4 L13.4 19.9 L17.6 17.4 L19.6 18.9 L25.2 16.8" fill="none" stroke="${accent}" stroke-width="1.7"/></svg>`;
writeFileSync(`${OUT}/snolage-marke.svg`, mark("#1c5d99", "#ffffff") + "\n");
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const p = await b.newPage({ deviceScaleFactor: 1, viewport: { width: 2600, height: 800 } });
for (const [name, ink, accent, on] of [["snolage-logotyp", "#17222b", "#1c5d99", "#ffffff"], ["snolage-logotyp-vit", "#ffffff", "#8ec5f0", "#0a1622"]]) {
  await p.setContent(`<style>@font-face{font-family:IS;src:url(data:font/woff2;base64,${woff}) format("woff2");font-stretch:75% 100%;font-weight:400 700}
  body{margin:0;background:transparent}#l{display:inline-flex;align-items:center;gap:72px;padding:40px;font:700 400px/1 IS;font-stretch:78%;color:${ink};letter-spacing:-4px}
  #l svg{width:440px;height:440px}</style><div id="l">${mark(accent, on)}<span>Snöläge</span></div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.locator("#l").screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
}
await b.close();
await sharp(`${APP}/assets/icon-only.png`).resize(1024).png().toFile(`${OUT}/snolage-appikon.png`);
const shots = ["1-idag", "2-omrade", "3-rutt", "4-tur", "5-observera", "6-observationer"];
for (const lang of ["sv", "en"]) for (const s of shots) {
  await sharp(`${STORE}/${lang}-${s}.png`).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}/skarmbild-${lang}-${s}.jpg`);
  await sharp(`${STORE}/${lang}-${s}.png`).resize(360).webp({ quality: 80 }).toFile(`${OUT}/skarmbild-${lang}-${s}-liten.webp`);
}
for (const n of ["snolage-logotyp", "snolage-logotyp-vit"]) await sharp(`${OUT}/${n}.png`).resize(520).webp({ quality: 90 }).toFile(`${OUT}/${n}-liten.webp`);
console.log("done");
