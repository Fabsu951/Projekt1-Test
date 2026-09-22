import type { DangerLevelInfo } from "../types/avalanche";

export const DANGER_SCALE: DangerLevelInfo[] = [
  {
    level: 1,
    label: "Liten fara",
    color: "#4caf50",
    description:
      "Generellt säkra förhållanden. Snötäcket är stabilt förutom i enstaka extremt brant terräng. Lös- och flaklaviner kan endast utlösas med stor tillkommande belastning på enstaka mycket branta partier.",
  },
  {
    level: 2,
    label: "Måttlig fara",
    color: "#ffeb3b",
    description:
      "Snötäcket är måttligt stabilt på branta partier. Laviner kan utlösas med stor tillkommande belastning, framförallt på de angivna terrängtyperna. Större spontana laviner är inte att vänta.",
  },
  {
    level: 3,
    label: "Betydande fara",
    color: "#ff9800",
    description:
      "Snötäcket är måttligt till svagt stabiliserat på många branta partier. Laviner kan utlösas redan vid liten tillkommande belastning, framförallt på de angivna terrängtyperna. Medelstora, i vissa fall stora, spontana laviner är möjliga.",
  },
  {
    level: 4,
    label: "Stor fara",
    color: "#f44336",
    description:
      "Snötäcket är svagt stabiliserat på de flesta branta partier. Laviner är sannolika redan vid liten tillkommande belastning på många branta partier. I vissa fall är flera medelstora, ibland stora, spontana laviner att vänta.",
  },
  {
    level: 5,
    label: "Mycket stor fara",
    color: "#212121",
    description:
      "Instabilt snötäcke i det mesta av terrängen. Många stora spontana laviner, även i måttligt brant terräng, är att vänta. Undvik all skidåkning utanför preparerade pister.",
  },
];

export function getDangerInfo(level: number): DangerLevelInfo {
  return DANGER_SCALE[Math.min(Math.max(level, 1), 5) - 1];
}
