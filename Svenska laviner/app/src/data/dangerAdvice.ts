import type { AvalancheProblem, Source } from "../types/avalanche";
import { t } from "../i18n";

// Plain-language advice for each danger level and each avalanche problem,
// worded after EAWS's danger scale and lavinprognoser.se's "Så läser du
// lavinprognosen". General advice only: it never says a slope is safe, and
// the forecast itself always comes first.

export const LEVEL_ADVICE: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  1: [
    t("Lavinfaran är låg men inte borta. Enstaka mycket branta partier kan fortfarande släppa, särskilt de som prognosen nämner."),
    t("Tänk på vad som finns nedanför: en liten lavin är farlig ovanför stup, raviner eller skog."),
    t("Åk en i taget i de brantaste partierna och ha med lavinutrustning som vanligt."),
  ],
  2: [
    t("Var särskilt försiktig på de väderstreck och höjder som prognosen pekar ut."),
    t("Bedöm varje sluttning brantare än 30° för sig och undvik terrängfällor nedanför."),
    t("Åk en i taget i branta partier och samla gruppen på platser utanför lavinbanor."),
  ],
  3: [
    t("Här sker många av olyckorna. Snötäcket kan släppa av en enda skidåkare, ibland på avstånd."),
    t("Undvik branter över 30° på de väderstreck och höjder prognosen pekar ut. Välj hellre flackare terräng utan terrängfällor."),
    t("Turåkning i lavinterräng kräver nu god erfarenhet av att bedöma snö och terräng."),
  ],
  4: [
    t("Laviner är sannolika redan av en skidåkare, och stora laviner kan gå av sig själva."),
    t("Håll dig i måttligt brant terräng under 30° och håll stort avstånd från brantare sluttningar ovanför och bredvid dig."),
    t("Många väljer skogen eller att avstå helt. Det är ett klokt val."),
  ],
  5: [
    t("Undvik all lavinterräng. Stora laviner kan nå ända ner i flacka dalbottnar."),
    t("Stanna i preparerade pister eller vänta tills faran har minskat."),
  ],
};

export const PROBLEM_ADVICE: Record<AvalancheProblem, string> = {
  nysno: t("Ge den nya snön ett till två dygn att sätta sig. Var försiktig där den ligger tjockt, särskilt i branta läsidor."),
  vindpack: t("Lär dig känna igen vindpackad snö: hård och kritaktig, ibland ihålig under skidorna, ofta under krön och i fördjupningar. Undvik branta läsidor där den har samlats."),
  gammal_svag_lagring: t("Svårt att upptäcka och kan utlösas på avstånd eller där snötäcket är tunt. Ha stora marginaler och välj måttligt brant terräng så länge problemet finns."),
  vatsno: t("Var ute tidigt medan snön är frusen och lämna branta sluttningar när snön blir blöt och du börjar sjunka in."),
  glidlavin: t("Håll dig undan från områden under glidsprickor och stanna aldrig under dem. Tidpunkten går inte att förutsäga."),
  hangdrivor: t("Håll avstånd från krön, längre in än du tror, och vistas inte under stora hängdrivor."),
};

export const ADVICE_SOURCES: Source[] = [
  { label: "EAWS – Avalanche Danger Scale", url: "https://www.avalanches.org/standards/avalanche-danger-scale/" },
  {
    label: "lavinprognoser.se – Så läser du lavinprognosen",
    url: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/",
  },
];

export function levelAdvice(level: number | null): string[] {
  if (level === null || level < 1 || level > 5) return [];
  return LEVEL_ADVICE[level as 1 | 2 | 3 | 4 | 5];
}
