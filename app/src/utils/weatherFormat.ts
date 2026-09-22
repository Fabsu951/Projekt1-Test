const SYMBOL_LABELS: Record<number, string> = {
  1: "Klart",
  2: "Mest klart",
  3: "Växlande molnighet",
  4: "Halvklart",
  5: "Molnigt",
  6: "Mulet",
  7: "Dimma",
  8: "Lätta regnskurar",
  9: "Måttliga regnskurar",
  10: "Kraftiga regnskurar",
  11: "Åskskurar",
  12: "Lätt snöblandat regn",
  13: "Måttligt snöblandat regn",
  14: "Kraftigt snöblandat regn",
  15: "Lätta snöbyar",
  16: "Måttliga snöbyar",
  17: "Kraftiga snöbyar",
  18: "Lätt regn",
  19: "Måttligt regn",
  20: "Kraftigt regn",
  21: "Åska",
  22: "Lätt snöblandat regn",
  23: "Måttligt snöblandat regn",
  24: "Kraftigt snöblandat regn",
  25: "Lätt snöfall",
  26: "Måttligt snöfall",
  27: "Kraftigt snöfall",
};

export function symbolLabel(symbol: number): string {
  return SYMBOL_LABELS[symbol] ?? "Okänt";
}

const COMPASS = [
  "N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
  "S", "SSV", "SV", "VSV", "V", "VNV", "NV", "NNV",
];

export function windCompass(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS[index];
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
