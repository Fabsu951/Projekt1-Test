import { locale } from "../i18n";
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km` : `${m} m`;
}

export function formatDuration(s: number | null): string | null {
  if (s === null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function formatTourDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
}
