import type { DangerSign, ObservationType } from "../types/observation";
import { dangerSignLabel } from "./dangerSigns";
import { t } from "../i18n";

// "Snabbobservation": big buttons for what you saw, turned into an ordinary
// observation (type, warning signs, a description the worker accepts).

export type QuickChoice = DangerSign | "inga_tecken";

/** In priority order: the first chosen one decides the observation type. */
export const QUICK_CHOICES: Array<{ choice: QuickChoice; label: string; type: ObservationType }> = [
  { choice: "farska_laviner", label: t("Färsk lavin"), type: "lavin" },
  { choice: "skjutsprickor", label: t("Skjutsprickor"), type: "sprickor" },
  { choice: "wumpf", label: t("Wumpf / kollaps"), type: "kollaps" },
  { choice: "snodrev", label: t("Snödrev"), type: "ovrigt" },
  { choice: "mycket_nysno", label: t("Mycket nysnö"), type: "ovrigt" },
  { choice: "snabb_uppvarmning", label: t("Värme eller regn"), type: "ovrigt" },
  { choice: "inga_tecken", label: t("Inga varningstecken"), type: "ovrigt" },
];

export interface QuickObservation {
  type: ObservationType;
  dangerSigns: DangerSign[];
  description: string;
}

/** Null until something is chosen. "Inga varningstecken" can't be combined with signs. */
export function quickObservation(chosen: QuickChoice[], note: string): QuickObservation | null {
  const ordered = QUICK_CHOICES.filter((c) => chosen.includes(c.choice));
  if (ordered.length === 0) return null;
  const signs = ordered.map((c) => c.choice).filter((c): c is DangerSign => c !== "inga_tecken");
  const summary = signs.length
    ? t("Snabbobservation: {signs}.", { signs: signs.map((s) => dangerSignLabel(s)).join(", ") })
    : t("Snabbobservation: inga varningstecken.");
  const extra = note.trim();
  return { type: ordered[0].type, dangerSigns: signs, description: extra ? `${summary} ${extra}` : summary };
}

/** Tapping "Inga varningstecken" clears the signs, and a sign clears "Inga varningstecken". */
export function toggleChoice(chosen: QuickChoice[], choice: QuickChoice): QuickChoice[] {
  if (chosen.includes(choice)) return chosen.filter((c) => c !== choice);
  if (choice === "inga_tecken") return ["inga_tecken"];
  return [...chosen.filter((c) => c !== "inga_tecken"), choice];
}
