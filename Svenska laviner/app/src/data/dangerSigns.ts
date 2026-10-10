import type { DangerSign } from "../types/observation";
import { t } from "../i18n";

/** Warning signs an observer can tick; the ids match the worker's DANGER_SIGNS. */
export const DANGER_SIGNS: Array<{ sign: DangerSign; label: string }> = [
  { sign: "farska_laviner", label: t("Färska laviner") },
  { sign: "skjutsprickor", label: t("Skjutsprickor") },
  { sign: "wumpf", label: t("Wumpf / kollaps") },
  { sign: "snodrev", label: t("Pågående snödrev") },
  { sign: "mycket_nysno", label: t("Mycket nysnö") },
  { sign: "snabb_uppvarmning", label: t("Snabb uppvärmning eller regn") },
];

export function dangerSignLabel(sign: string): string | null {
  return DANGER_SIGNS.find((s) => s.sign === sign)?.label ?? null;
}
