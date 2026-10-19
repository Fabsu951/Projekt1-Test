import { getDangerInfo } from "../data/dangerScale";
import type { AvalancheForecast, AvalancheRegion, DangerLevel } from "../types/avalanche";
import { forecastLabel } from "../utils/forecastLabel";
import { problemWhere } from "../utils/today";
import { isNativeApp } from "./native";
import { locale, t } from "../i18n";

// "Dela som bild": today's published forecast drawn as an image for Instagram,
// Facebook and chats, in Snöläge's paper-map look. Only a published level from
// a fresh answer is ever drawn – never a guessed or saved (offline) one – and
// the image says when the forecast was published, since it can't update.

export type ImageFormat = "post" | "story";

export const IMAGE_SIZES: Record<ImageFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

export interface AreaImage {
  kind: "area";
  areaName: string;
  /** "Lavinprognos måndag 20 oktober". */
  dateLine: string;
  level: DangerLevel;
  label: string;
  problems: Array<{ name: string; where: string }>;
  /** Used when the forecast lists no problems. */
  headline: string | null;
  publishedText: string | null;
}

export interface OverviewImage {
  kind: "overview";
  dateLine: string;
  rows: Array<{ name: string; level: DangerLevel | null; label: string }>;
  publishedText: string | null;
}

export type ShareImageModel = AreaImage | OverviewImage;

function dayText(now: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" }).format(now);
}

/** The image for one area, or null unless there is a fresh, published level. */
export function areaImage(region: AvalancheRegion, forecast: AvalancheForecast | null | undefined, stale: boolean, now: Date): AreaImage | null {
  if (stale || !forecast || forecast.status !== "published" || forecast.dangerLevel === null) return null;
  return {
    kind: "area",
    areaName: region.name,
    dateLine: t("Lavinprognos {day}", { day: dayText(now) }),
    level: forecast.dangerLevel,
    label: getDangerInfo(forecast.dangerLevel).label,
    problems: forecast.problems.map((p) => ({ name: p.name, where: problemWhere(p) })),
    headline: forecast.headline,
    publishedText: forecast.publishedText,
  };
}

/** All areas in one image, or null unless at least one has a fresh, published level. */
export function overviewImage(
  regions: AvalancheRegion[],
  forecasts: Record<string, AvalancheForecast>,
  stale: boolean,
  now: Date,
): OverviewImage | null {
  if (stale) return null;
  const rows = regions.flatMap((r) => {
    const f = forecasts[r.id];
    if (!f) return [];
    const level = f.status === "published" ? f.dangerLevel : null;
    return [{ name: r.name, level, label: forecastLabel(f) }];
  });
  if (!rows.some((r) => r.level !== null)) return null;
  const published = regions.map((r) => forecasts[r.id]).find((f) => f?.status === "published" && f.publishedText);
  return {
    kind: "overview",
    dateLine: t("Lavinprognoser {day}", { day: dayText(now) }),
    rows,
    publishedText: published?.publishedText ?? null,
  };
}

// --- Drawing ---------------------------------------------------------------

const PAPER = "#f6f7f6";
const INK = "#17222b";
const MUTED = "#5c6873";
const LAKE = "#1c5d99";
const CONTOUR = "#cdbba3";
const FAMILY = '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif';
const MARGIN = 80;

// Height curves around a summit, as in components/Contours.tsx (viewBox 30 0 460 300).
const RINGS = [
  "M296 8c80 4 152 42 172 108 21 70-18 138-90 168-80 33-190 27-254-20-60-44-70-118-28-174 40-54 116-86 200-82Z",
  "M300 40c58 4 112 30 128 78 17 52-12 104-66 126-58 24-140 20-188-14-44-31-52-86-22-128 30-42 86-65 148-62Z",
  "M302 70c44 3 84 23 95 58 12 38-9 76-48 92-43 18-104 15-139-10-32-23-38-63-16-94 22-31 63-49 108-46Z",
  "M304 98c32 2 60 16 68 41 8 27-7 54-35 65-31 13-74 11-99-7-23-16-27-45-11-67 16-22 45-34 77-32Z",
  "M305 124c20 1 37 10 42 25 5 17-4 33-22 40-19 8-46 7-61-4-14-10-17-28-7-41 10-14 28-21 48-20Z",
  "M306 146c9 0 16 5 18 11 2 8-2 15-10 18-9 4-21 3-27-2-6-5-7-12-3-18 5-6 13-9 22-9Z",
];

type Ctx = CanvasRenderingContext2D & { fontStretch?: string };

function font(ctx: Ctx, weight: number, size: number, narrow = false) {
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  // Narrow like the app's headings where the browser can (Safari draws normal width).
  if ("fontStretch" in ctx) ctx.fontStretch = narrow ? "condensed" : "normal";
}

/** Words onto lines no wider than maxWidth. */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size from `size` down to `min` at which `text` fits on one line. */
function fit(ctx: Ctx, text: string, weight: number, size: number, min: number, maxWidth: number, narrow = true): number {
  let s = size;
  for (; s > min; s -= 4) {
    font(ctx, weight, s, narrow);
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  font(ctx, weight, s, narrow);
  return s;
}

function contours(ctx: Ctx, x: number, y: number, scale: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-30, 0);
  ctx.strokeStyle = CONTOUR;
  ctx.globalAlpha = alpha;
  RINGS.forEach((d, i) => {
    ctx.lineWidth = (i === 3 ? 2.4 : 1.4) / scale * 2;
    ctx.stroke(new Path2D(d));
  });
  ctx.restore();
}

function brand(ctx: Ctx, y: number) {
  const size = 60;
  ctx.save();
  ctx.translate(MARGIN, y);
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = LAKE;
  ctx.beginPath();
  ctx.roundRect(0, 0, 32, 32, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D("M4 25 L13.2 8.5 L18 16.6 L20.6 12.6 L28 25 Z"));
  ctx.strokeStyle = LAKE;
  ctx.lineWidth = 1.7;
  ctx.stroke(new Path2D("M6.6 20.6 L11.4 18.4 L13.4 19.9 L17.6 17.4 L19.6 18.9 L25.2 16.8"));
  ctx.restore();
  font(ctx, 700, 46, true);
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText("Snöläge", MARGIN + size + 20, y + size / 2 + 2);
  ctx.textBaseline = "alphabetic";
}

/** The danger scale as five rising steps, today's filled (components/DangerStair.tsx). */
function stair(ctx: Ctx, level: number, x: number, bottom: number, width: number, color: string) {
  const unit = width / 54;
  ctx.save();
  ctx.translate(x, bottom - 30 * unit);
  ctx.scale(unit, unit);
  ctx.lineWidth = 1.5;
  for (let s = 1; s <= 5; s++) {
    const h = 6 + s * 4.8;
    ctx.beginPath();
    ctx.roundRect((s - 1) * 11 + 0.75, 30 - h + 0.75, 9.5, h - 1.5, 1.5);
    ctx.strokeStyle = color;
    ctx.globalAlpha = s === level ? 1 : 0.45;
    ctx.stroke();
    if (s === level) {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  ctx.restore();
}

const FOOTER_LINE = 36;

function footerLines(ctx: Ctx, width: number, publishedText: string | null): string[] {
  font(ctx, 400, 28);
  const lines = [
    t("Prognos från Naturvårdsverket, lavinprognoser.se"),
    publishedText ? t("Publicerad {time}. Läs hela prognosen innan du åker.", { time: publishedText }) : t("Läs hela prognosen innan du åker."),
  ];
  return lines.flatMap((line) => wrap(ctx, line, width - 2 * MARGIN));
}

/** Where the footer starts, so the content above can stop in time. */
function footerTop(ctx: Ctx, width: number, height: number, publishedText: string | null): number {
  return height - 64 - 118 - (footerLines(ctx, width, publishedText).length - 1) * FOOTER_LINE;
}

/** Source, publication time and the address, at the bottom. */
function footer(ctx: Ctx, width: number, height: number, publishedText: string | null) {
  const top = footerTop(ctx, width, height, publishedText);
  ctx.strokeStyle = CONTOUR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, top);
  ctx.lineTo(width - MARGIN, top);
  ctx.stroke();

  font(ctx, 700, 52, true);
  ctx.fillStyle = LAKE;
  ctx.fillText("snolage.se", MARGIN, top + 72);

  const lines = footerLines(ctx, width, publishedText);
  ctx.fillStyle = MUTED;
  let y = top + 118;
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y);
    y += FOOTER_LINE;
  }
}

function drawArea(ctx: Ctx, m: AreaImage, width: number, height: number) {
  const story = height > 1500;
  // Sizes per format: the story has room to breathe, the post is kept tight.
  const L = story
    ? { brand: 120, title: 380, gap: 80, band: 420, numeral: 340, label: 84, sub: 36, stair: 230, after: 120, heading: 54, first: 90, name: 50, where: 36, whereGap: 50, step: 136, max: 4 }
    : { brand: 72, title: 270, gap: 48, band: 280, numeral: 240, label: 68, sub: 30, stair: 170, after: 86, heading: 46, first: 66, name: 42, where: 30, whereGap: 40, step: 96, max: 3 };
  contours(ctx, width - 520, story ? 150 : 100, 1.3, 0.75);
  brand(ctx, L.brand);

  let y = L.title;
  const nameSize = fit(ctx, m.areaName, 700, 124, 72, width - 2 * MARGIN);
  ctx.fillStyle = INK;
  ctx.fillText(m.areaName, MARGIN, y);
  y += 30 + Math.round(nameSize * 0.35);
  font(ctx, 400, 40);
  ctx.fillStyle = MUTED;
  ctx.fillText(m.dateLine, MARGIN, y);

  // The band: today's level in its danger colour, edge to edge.
  const info = getDangerInfo(m.level);
  const bandTop = y + L.gap;
  const bandH = L.band;
  const onBand = info.level >= 5 ? "#ffffff" : INK;
  ctx.fillStyle = info.color;
  ctx.fillRect(0, bandTop, width, bandH);
  ctx.fillStyle = onBand;
  font(ctx, 700, L.numeral, true);
  const numeral = String(info.level);
  const base = bandTop + bandH * 0.8;
  ctx.fillText(numeral, MARGIN - 6, base);
  const textX = MARGIN + ctx.measureText(numeral).width + 44;
  const stairX = width - MARGIN - L.stair;
  const textW = stairX - textX - 30;
  fit(ctx, info.label, 700, L.label, 44, textW);
  ctx.fillText(info.label, textX, bandTop + bandH * 0.48);
  font(ctx, 400, L.sub);
  wrap(ctx, t("Lavinfara enligt dagens prognos"), textW)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, textX, bandTop + bandH * 0.48 + L.sub * 1.5 + i * L.sub * 1.25));
  stair(ctx, info.level, stairX, base, L.stair, onBand);

  // What the forecast warns about.
  y = bandTop + bandH + L.after;
  const limit = footerTop(ctx, width, height, m.publishedText) - 16;
  ctx.fillStyle = INK;
  if (m.problems.length > 0) {
    font(ctx, 700, L.heading, true);
    ctx.fillText(t("Lavinproblem"), MARGIN, y);
    y += L.first;
    // Every shown problem (name + where) must clear the footer, with a line for "och N till" when some are left out.
    const fits = (n: number) => y + (n - 1) * L.step + L.whereGap + (n < m.problems.length ? 48 : 0) <= limit;
    let count = Math.min(m.problems.length, L.max);
    while (count > 1 && !fits(count)) count--;
    for (const p of m.problems.slice(0, count)) {
      font(ctx, 600, L.name);
      ctx.fillStyle = INK;
      ctx.fillText(p.name, MARGIN, y);
      if (p.where) {
        font(ctx, 400, L.where);
        ctx.fillStyle = MUTED;
        ctx.fillText(wrap(ctx, p.where, width - 2 * MARGIN)[0] ?? "", MARGIN, y + L.whereGap);
      }
      y += L.step;
    }
    const more = m.problems.length - count;
    if (more > 0) {
      font(ctx, 400, L.where);
      ctx.fillStyle = MUTED;
      ctx.fillText(t("och {n} till i prognosen", { n: more }), MARGIN, y - L.step + L.whereGap + 46);
    }
  } else if (m.headline) {
    font(ctx, 600, story ? 52 : 44);
    const lineH = story ? 66 : 56;
    for (const line of wrap(ctx, m.headline, width - 2 * MARGIN)) {
      if (y > limit) break;
      ctx.fillText(line, MARGIN, y);
      y += lineH;
    }
  }

  footer(ctx, width, height, m.publishedText);
}

function drawOverview(ctx: Ctx, m: OverviewImage, width: number, height: number) {
  const story = height > 1500;
  contours(ctx, width - 520, story ? 150 : 100, 1.3, 0.75);
  brand(ctx, story ? 120 : 72);

  let y = story ? 380 : 270;
  fit(ctx, t("Lavinläget i fjällen"), 700, 112, 64, width - 2 * MARGIN);
  ctx.fillStyle = INK;
  ctx.fillText(t("Lavinläget i fjällen"), MARGIN, y);
  y += 62;
  font(ctx, 400, 40);
  ctx.fillStyle = MUTED;
  ctx.fillText(m.dateLine, MARGIN, y);

  const top = y + (story ? 110 : 64);
  const available = footerTop(ctx, width, height, m.publishedText) - 30 - top;
  const rowH = Math.min(story ? 190 : 140, Math.floor(available / Math.max(1, m.rows.length)));
  const tile = Math.round(rowH * 0.72);
  m.rows.forEach((row, i) => {
    const rowTop = top + i * rowH;
    const tileY = rowTop + (rowH - tile) / 2;
    if (i > 0) {
      ctx.strokeStyle = CONTOUR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN, rowTop);
      ctx.lineTo(width - MARGIN, rowTop);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(MARGIN, tileY, tile, tile, 12);
    if (row.level !== null) {
      const info = getDangerInfo(row.level);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.fillStyle = info.level >= 5 ? "#ffffff" : INK;
      font(ctx, 700, Math.round(tile * 0.72), true);
      ctx.textAlign = "center";
      ctx.fillText(String(info.level), MARGIN + tile / 2, tileY + tile * 0.77);
      ctx.textAlign = "left";
    } else {
      ctx.strokeStyle = "#b9c2c8";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const textX = MARGIN + tile + 36;
    fit(ctx, row.name, 600, Math.round(rowH * 0.36), 30, width - MARGIN - textX, true);
    ctx.fillStyle = INK;
    ctx.fillText(row.name, textX, rowTop + rowH * 0.47);
    font(ctx, 400, Math.round(rowH * 0.24));
    ctx.fillStyle = row.level !== null ? INK : MUTED;
    ctx.fillText(row.label, textX, rowTop + rowH * 0.8);
  });

  footer(ctx, width, height, m.publishedText);
}

/** Draws the image; resolves to a PNG. */
export async function drawShareImage(model: ShareImageModel, format: ImageFormat): Promise<Blob> {
  const { width, height } = IMAGE_SIZES[format];
  if (document.fonts) {
    await Promise.all(
      ["400 40px", "600 40px", "700 40px"].map((f) => document.fonts.load(`${f} "Instrument Sans Variable"`).catch(() => [])),
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error(t("Bilden kunde inte skapas på den här enheten."));
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  if (model.kind === "area") drawArea(ctx, model, width, height);
  else drawOverview(ctx, model, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t("Bilden kunde inte skapas på den här enheten.")))), "image/png"),
  );
}

// --- Sharing ---------------------------------------------------------------

export type ImageShareOutcome = "shared" | "saved" | "cancelled" | "failed";

function cancelled(err: unknown): boolean {
  const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /abort|cancel/i.test(message);
}

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Whether "Dela bilden" can hand the image to other apps here. */
export function canShareImage(): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], "test.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** The phone's share sheet with the image (apps, and browsers that can share files). */
export async function shareImageFile(blob: Blob, fileName: string, title: string, text: string): Promise<ImageShareOutcome> {
  try {
    if (isNativeApp()) {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
      const written = await Filesystem.writeFile({ path: fileName, data: await base64(blob), directory: Directory.Cache });
      await Share.share({ title, text, files: [written.uri], dialogTitle: t("Dela bilden") });
      return "shared";
    }
    const file = new File([blob], fileName, { type: "image/png" });
    await navigator.share({ files: [file], title, text });
    return "shared";
  } catch (err) {
    return cancelled(err) ? "cancelled" : "failed";
  }
}

/** Downloads the image (browsers). */
export function downloadImage(blob: Blob, fileName: string): ImageShareOutcome {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}
