import type { DangerSign } from "../types/observation";

/** Warning signs an observer can tick; the ids match the worker's DANGER_SIGNS. */
export const DANGER_SIGNS: Array<{ sign: DangerSign; label: string }> = [
  { sign: "farska_laviner", label: "Färska laviner" },
  { sign: "skjutsprickor", label: "Skjutsprickor" },
  { sign: "wumpf", label: "Wumpf / kollaps" },
  { sign: "snodrev", label: "Pågående snödrev" },
  { sign: "mycket_nysno", label: "Mycket nysnö" },
  { sign: "snabb_uppvarmning", label: "Snabb uppvärmning eller regn" },
];

export function dangerSignLabel(sign: string): string | null {
  return DANGER_SIGNS.find((s) => s.sign === sign)?.label ?? null;
}
