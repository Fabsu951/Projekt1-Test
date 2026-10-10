import type { ObservationType } from "../types/observation";
import { t } from "../i18n";

export const OBSERVATION_TYPES: Array<{ type: ObservationType; label: string; hint: string }> = [
  { type: "lavin", label: t("Lavin"), hint: t("Du såg en lavin som gått, eller utlöste en.") },
  { type: "sprickor", label: t("Sprickor / bristningar"), hint: t("Skjutsprickor som löper ut från skidorna.") },
  { type: "kollaps", label: t("Kollaps (wumpf)"), hint: t("Snötäcket satte sig med ett dovt ljud.") },
  { type: "glidsprickor", label: t("Glidsprickor / släpp"), hint: t("Öppna sprickor där snötäcket glider på marken.") },
  { type: "snotacke", label: t("Snötäcke"), hint: t("Snöprofil, stabilitetstest, svaga lager.") },
  { type: "ovrigt", label: t("Övrigt"), hint: t("Annat som är värt att dela, t.ex. vindtransport eller skare.") },
];

export function observationTypeLabel(type: string): string {
  return OBSERVATION_TYPES.find((entry) => entry.type === type)?.label ?? t("Observation");
}
