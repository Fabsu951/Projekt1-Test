import type { ObservationType } from "../types/observation";

export const OBSERVATION_TYPES: Array<{ type: ObservationType; label: string; hint: string }> = [
  { type: "lavin", label: "Lavin", hint: "Du såg en lavin som gått, eller utlöste en." },
  { type: "sprickor", label: "Sprickor / bristningar", hint: "Skjutsprickor som löper ut från skidorna." },
  { type: "kollaps", label: "Kollaps (wumpf)", hint: "Snötäcket satte sig med ett dovt ljud." },
  { type: "glidsprickor", label: "Glidsprickor / släpp", hint: "Öppna sprickor där snötäcket glider på marken." },
  { type: "snotacke", label: "Snötäcke", hint: "Snöprofil, stabilitetstest, svaga lager." },
  { type: "ovrigt", label: "Övrigt", hint: "Annat som är värt att dela, t.ex. vindtransport eller skare." },
];

export function observationTypeLabel(type: string): string {
  return OBSERVATION_TYPES.find((t) => t.type === type)?.label ?? "Observation";
}
