import type { AvalancheProblem, Source } from "../types/avalanche";

/**
 * The avalanche problems lavinprognoser.se uses, named as the forecasts name
 * them. They follow EAWS's (European Avalanche Warning Services) standard
 * problem types, plus "hängdrivor" (cornices).
 */
export const PROBLEM_LABELS: Record<AvalancheProblem, { label: string; description: string }> = {
  nysno: {
    label: "Nysnöflak",
    description: "Nyfallen snö som ännu inte bundit till underlaget, särskilt på lä-sidor.",
  },
  vindpack: {
    label: "Drevsnöflak",
    description: "Vinden har flyttat snö till hårda, spröda flak på läsidor och i fördjupningar.",
  },
  gammal_svag_lagring: {
    label: "Bestående flak",
    description: "Ett svagt lager djupt i snötäcket som kan brytas av stor belastning, svårbedömt och farligt.",
  },
  vatsno: {
    label: "Våta laviner",
    description: "Smältvatten eller regn har försvagat snötäcket, ofta senare på dagen eller vid varmt väder.",
  },
  glidlavin: {
    label: "Glidlaviner",
    description:
      "Hela snötäcket glider sakta på underlaget (ofta hala klippor eller blöt mark), ibland synligt som sprickor i snön. Kan lossna helt plötsligt och går inte att utlösa eller förutsäga tidpunkten för.",
  },
  hangdrivor: {
    label: "Hängdrivor",
    description:
      "Snö som vinden byggt ut över krön och branta kanter. En hängdriva kan brista längre in än man tror, och när den rasar kan den i sin tur utlösa en lavin i sluttningen nedanför.",
  },
};

/** lavinprognoser.se's URL slug for each problem type, as used in its forecasts. */
export const SITE_PROBLEM_TYPES: Record<string, AvalancheProblem> = {
  nysnoflak: "nysno",
  drevsnoflak: "vindpack",
  "bestaende-flak": "gammal_svag_lagring",
  "vata-laviner": "vatsno",
  glidlaviner: "glidlavin",
  hangdrivor: "hangdrivor",
};

export const PROBLEM_SOURCES: Source[] = [
  {
    label: "lavinprognoser.se – Lavinproblem",
    url: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/lavinproblem/",
  },
  { label: "EAWS – Avalanche Problems", url: "https://www.avalanches.org/standards/avalanche-problems/" },
];
