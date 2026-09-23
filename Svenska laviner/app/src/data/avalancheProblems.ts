import type { AvalancheProblem, Source } from "../types/avalanche";

/**
 * The five avalanche problem types are EAWS's (European Avalanche Warning
 * Services) standard classification, used across ~30 European avalanche
 * services including lavinprognoser.se.
 */
export const PROBLEM_LABELS: Record<AvalancheProblem, { label: string; description: string }> = {
  nysno: {
    label: "Nysnö",
    description: "Nyfallen snö som ännu inte bundit till underlaget, särskilt på lä-sidor.",
  },
  vindpack: {
    label: "Vindpackad snö",
    description: "Vinden har flyttat snö till hårda, spröda flak på läsidor och i fördjupningar.",
  },
  gammal_svag_lagring: {
    label: "Gammal svag lagring",
    description: "Ett svagt lager djupt i snötäcket som kan brytas av stor belastning, svårbedömt och farligt.",
  },
  vatsno: {
    label: "Våt snö",
    description: "Smältvatten eller regn har försvagat snötäcket, ofta senare på dagen eller vid varmt väder.",
  },
  glidlavin: {
    label: "Glidlavin",
    description:
      "Hela snötäcket glider sakta på underlaget (ofta hala klippor eller blöt mark), ibland synligt som sprickor i snön. Kan lossna helt plötsligt och går inte att utlösa eller förutsäga tidpunkten för.",
  },
};

export const PROBLEM_SOURCES: Source[] = [
  { label: "EAWS – Avalanche Problems", url: "https://www.avalanches.org/standards/avalanche-problems/" },
];
