/** Parts of the ski season, for filtering tours by when they were done. */
export const TOUR_SEASONS: Array<{ id: string; label: string; months: number[] }> = [
  { id: "tidig", label: "Tidig vinter (nov–dec)", months: [11, 12] },
  { id: "mid", label: "Midvinter (jan–feb)", months: [1, 2] },
  { id: "var", label: "Vårvinter (mar–apr)", months: [3, 4] },
  { id: "sen", label: "Sen vår (maj–jun)", months: [5, 6] },
];

/** The months covered by the picked seasons; empty means all months. */
export function seasonMonths(seasonIds: string[]): number[] {
  return TOUR_SEASONS.filter((s) => seasonIds.includes(s.id)).flatMap((s) => s.months);
}

export const HIDE_ENDS_CHOICES: Array<{ meters: number; label: string }> = [
  { meters: 0, label: "Visa hela spåret" },
  { meters: 200, label: "Dölj första och sista 200 m" },
  { meters: 500, label: "Dölj första och sista 500 m" },
  { meters: 1000, label: "Dölj första och sista 1 km" },
];
