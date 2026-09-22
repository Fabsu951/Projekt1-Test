import type { AvalancheProblem } from "../types/avalanche";

export const PROBLEM_LABELS: Record<AvalancheProblem, { label: string; description: string }> = {
  nysno: {
    label: "Nysnö",
    description: "Nyfallen snö som ännu inte bundit till underlaget, särskilt på lä-sidor.",
  },
  vindpack: {
    label: "Vindpackad snö",
    description: "Vinden har flyttat snö till hårda, spröda flak på läsidor och i fördjupningar.",
  },
  flaklavin: {
    label: "Flaklavin",
    description: "Ett sammanhängande snötäcke kan lossna som ett helt flak över ett svagt lager.",
  },
  vatsno: {
    label: "Våt snö",
    description: "Smältvatten eller regn har försvagat snötäcket, ofta senare på dagen eller vid varmt väder.",
  },
  gammal_svag_lagring: {
    label: "Gammal svag lagring",
    description: "Ett svagt lager djupt i snötäcket som kan brytas av stor belastning, svårbedömt och farligt.",
  },
};
