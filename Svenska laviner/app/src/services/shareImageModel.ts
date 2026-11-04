import { getDangerInfo } from "../data/dangerScale";
import type { AvalancheForecast, AvalancheRegion, DangerLevel } from "../types/avalanche";
import { forecastLabel } from "../utils/forecastLabel";
import { problemWhere } from "../utils/today";
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
