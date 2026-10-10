import type { DangerLevelInfo, Source } from "../types/avalanche";
import { t } from "../i18n";

/**
 * The standard 5-level European avalanche danger scale, defined by EAWS
 * (European Avalanche Warning Services) and used identically by all ~30
 * member avalanche services, including lavinprognoser.se.
 */
export const DANGER_SCALE_SOURCES: Source[] = [
  { label: "EAWS – Avalanche Danger Scale", url: "https://www.avalanches.org/standards/avalanche-danger-scale/" },
];

export const DANGER_SCALE: DangerLevelInfo[] = [
  {
    level: 1,
    label: t("Liten fara"),
    color: "#4caf50",
    description:
      t("Generellt säkra förhållanden. Snötäcket är stabilt förutom i enstaka extremt brant terräng. Lös- och flaklaviner kan endast utlösas med stor tillkommande belastning på enstaka mycket branta partier."),
  },
  {
    level: 2,
    label: t("Måttlig fara"),
    color: "#ffeb3b",
    description:
      t("Snötäcket är måttligt stabilt på branta partier. Laviner kan utlösas med stor tillkommande belastning, framförallt på de angivna terrängtyperna. Större spontana laviner är inte att vänta."),
  },
  {
    level: 3,
    label: t("Betydande fara"),
    color: "#ff9800",
    description:
      t("Snötäcket är måttligt till svagt stabiliserat på många branta partier. Laviner kan utlösas redan vid liten tillkommande belastning, framförallt på de angivna terrängtyperna. Medelstora, i vissa fall stora, spontana laviner är möjliga."),
  },
  {
    level: 4,
    label: t("Stor fara"),
    color: "#f44336",
    description:
      t("Snötäcket är svagt stabiliserat på de flesta branta partier. Laviner är sannolika redan vid liten tillkommande belastning på många branta partier. I vissa fall är flera medelstora, ibland stora, spontana laviner att vänta."),
  },
  {
    level: 5,
    label: t("Mycket stor fara"),
    color: "#212121",
    description:
      t("Instabilt snötäcke i det mesta av terrängen. Många stora spontana laviner, även i måttligt brant terräng, är att vänta. Undvik all skidåkning utanför preparerade pister."),
  },
];

export function getDangerInfo(level: number): DangerLevelInfo {
  return DANGER_SCALE[Math.min(Math.max(level, 1), 5) - 1];
}
