import type { DangerSign, ObservationType } from "../types/observation";
import { dangerSignLabel } from "./dangerSigns";

// "Snabbobservation": big buttons for what you saw, turned into an ordinary
// observation (type, warning signs, a description the worker accepts).

export type QuickChoice = DangerSign | "inga_tecken";

/** In priority order: the first chosen one decides the observation type. */
export const QUICK_CHOICES: Array<{ choice: QuickChoice; label: string; type: ObservationType }> = [
  { choice: "farska_laviner", label: "Färsk lavin", type: "lavin" },
  { choice: "skjutsprickor", label: "Skjutsprickor", type: "sprickor" },
  { choice: "wumpf", label: "Wumpf / kollaps", type: "kollaps" },
  { choice: "snodrev", label: "Snödrev", type: "ovrigt" },
  { choice: "mycket_nysno", label: "Mycket nysnö", type: "ovrigt" },
  { choice: "snabb_uppvarmning", label: "Värme eller regn", type: "ovrigt" },
  { choice: "inga_tecken", label: "Inga varningstecken", type: "ovrigt" },
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
    ? `Snabbobservation: ${signs.map((s) => dangerSignLabel(s)).join(", ")}.`
    : "Snabbobservation: inga varningstecken.";
  const extra = note.trim();
  return { type: ordered[0].type, dangerSigns: signs, description: extra ? `${summary} ${extra}` : summary };
}

/** Tapping "Inga varningstecken" clears the signs, and a sign clears "Inga varningstecken". */
export function toggleChoice(chosen: QuickChoice[], choice: QuickChoice): QuickChoice[] {
  if (chosen.includes(choice)) return chosen.filter((c) => c !== choice);
  if (choice === "inga_tecken") return ["inga_tecken"];
  return [...chosen.filter((c) => c !== "inga_tecken"), choice];
}
