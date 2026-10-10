import { t, compass, locale } from "../i18n";
const SYMBOL_LABELS: Record<number, string> = {
  1: t("Klart"),
  2: t("Mest klart"),
  3: t("Växlande molnighet"),
  4: t("Halvklart"),
  5: t("Molnigt"),
  6: t("Mulet"),
  7: t("Dimma"),
  8: t("Lätta regnskurar"),
  9: t("Måttliga regnskurar"),
  10: t("Kraftiga regnskurar"),
  11: t("Åskskurar"),
  12: t("Lätt snöblandat regn"),
  13: t("Måttligt snöblandat regn"),
  14: t("Kraftigt snöblandat regn"),
  15: t("Lätta snöbyar"),
  16: t("Måttliga snöbyar"),
  17: t("Kraftiga snöbyar"),
  18: t("Lätt regn"),
  19: t("Måttligt regn"),
  20: t("Kraftigt regn"),
  21: t("Åska"),
  22: t("Lätt snöblandat regn"),
  23: t("Måttligt snöblandat regn"),
  24: t("Kraftigt snöblandat regn"),
  25: t("Lätt snöfall"),
  26: t("Måttligt snöfall"),
  27: t("Kraftigt snöfall"),
};

export function symbolLabel(symbol: number): string {
  return SYMBOL_LABELS[symbol] ?? t("Okänt");
}

const COMPASS = [
  "N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
  "S", "SSV", "SV", "VSV", "V", "VNV", "NV", "NNV",
];

export function windCompass(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return compass(COMPASS[index]);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
