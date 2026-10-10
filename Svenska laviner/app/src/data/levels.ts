import { t } from "../i18n";
// Experience levels and their profile-picture frames. Points come from the
// worker (tours logged, metres climbed, observations shared) and must stay
// in step with XP in worker/src/profile.ts.

export const XP_RULES = { perTour: 20, per100m: 1, perObservation: 30 } as const;

export interface Level {
  /** 0 = newcomer … 5 = highest. */
  index: number;
  name: string;
  /** Points needed to reach it. */
  minXp: number;
  /** Frame colours, light to dark. */
  colors: [string, string];
}

export const LEVELS: Level[] = [
  { index: 0, name: t("Nykomling"), minXp: 0, colors: ["#8a96a3", "#5c6772"] },
  { index: 1, name: t("Spårare"), minXp: 100, colors: ["#e0a46a", "#8a5a2b"] },
  { index: 2, name: t("Turåkare"), minXp: 300, colors: ["#f1f5f8", "#8e9aa6"] },
  { index: 3, name: t("Fjällvan"), minXp: 700, colors: ["#ffe28a", "#a87b1c"] },
  { index: 4, name: t("Fjällkunnig"), minXp: 1500, colors: ["#eafcff", "#6fa9c2"] },
  { index: 5, name: t("Fjällveteran"), minXp: 3000, colors: ["#9ff3ff", "#7a5cff"] },
];

export function levelFor(xp: number): { level: Level; next: Level | null; progress: number; toNext: number } {
  const level = [...LEVELS].reverse().find((l) => xp >= l.minXp) ?? LEVELS[0];
  const next = LEVELS[level.index + 1] ?? null;
  if (!next) return { level, next, progress: 1, toNext: 0 };
  return { level, next, progress: (xp - level.minXp) / (next.minXp - level.minXp), toNext: next.minXp - xp };
}
