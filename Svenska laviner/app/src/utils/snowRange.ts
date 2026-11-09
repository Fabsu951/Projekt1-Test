import { t } from "../i18n";

/** Water falling as snow → a range of fresh snow (1 mm is usually 1–2 cm), or null when it's next to nothing. */
export function snowRange(mm: number): string | null {
  if (mm < 0.5) return null;
  const low = Math.max(1, Math.round(mm));
  return t("ca {low}–{high} cm", { low, high: Math.max(low + 1, Math.round(mm * 2)) });
}
