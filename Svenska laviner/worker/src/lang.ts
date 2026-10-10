// Swedish is the app's own language; English for those who chose it in the
// app (users.lang, and lang on push subscriptions and app devices). Texts
// from Naturvårdsverket and other users stay as they were written.

export type Lang = "sv" | "en";

export const toLang = (value: unknown): Lang => (value === "en" ? "en" : "sv");

export async function userLang(db: D1Database, userId: number): Promise<Lang> {
  const row = await db.prepare("SELECT lang FROM users WHERE id = ?").bind(userId).first<{ lang: string }>();
  return toLang(row?.lang);
}

export const DANGER_NAMES: Record<Lang, Record<number, string>> = {
  sv: { 1: "Liten", 2: "Måttlig", 3: "Betydande", 4: "Stor", 5: "Mycket stor" },
  en: { 1: "Low", 2: "Moderate", 3: "Considerable", 4: "High", 5: "Very high" },
};

/** "3 Betydande lavinfara" / "3 Considerable avalanche danger". */
export function dangerText(level: number, lang: Lang): string {
  return lang === "en" ? `${level} ${DANGER_NAMES.en[level]} avalanche danger` : `${level} ${DANGER_NAMES.sv[level]} lavinfara`;
}

/** EAWS English names for lavinprognoser.se's problem slugs. */
const PROBLEM_NAMES_EN: Record<string, string> = {
  nysnoflak: "New snow",
  drevsnoflak: "Wind slab",
  "bestaende-flak": "Persistent weak layers",
  "vata-laviner": "Wet snow",
  glidlaviner: "Gliding snow",
  hangdrivor: "Cornices",
};

export function problemName(problem: { type: string; name: string }, lang: Lang): string {
  return lang === "en" ? (PROBLEM_NAMES_EN[problem.type] ?? problem.name) : problem.name;
}

const WEEKDAYS: Record<Lang, string[]> = {
  sv: ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS: Record<Lang, string[]> = {
  sv: ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "lördag 14 feb" / "Saturday 14 Feb" for a YYYY-MM-DD date. */
export function dayName(date: string, lang: Lang): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[lang][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[lang][m - 1]}`;
}

/** Compass points are stored the Swedish way (O = öst, V = väst). */
export const compass = (sector: string, lang: Lang): string =>
  lang === "en" ? sector.replace(/O/g, "E").replace(/V/g, "W") : sector;
