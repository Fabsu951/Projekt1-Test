import { describe, expect, it } from "vitest";
import { symbolLabel, windCompass } from "./weatherFormat";

describe("symbolLabel", () => {
  it("maps known SMHI symbol codes to Swedish labels", () => {
    expect(symbolLabel(1)).toBe("Klart");
    expect(symbolLabel(27)).toBe("Kraftigt snöfall");
  });

  it("falls back for unknown codes rather than throwing", () => {
    expect(symbolLabel(999)).toBe("Okänt");
  });
});

describe("windCompass", () => {
  it("maps cardinal degrees to compass labels", () => {
    expect(windCompass(0)).toBe("N");
    expect(windCompass(90)).toBe("O");
    expect(windCompass(180)).toBe("S");
    expect(windCompass(270)).toBe("V");
  });

  it("wraps around 360 degrees", () => {
    expect(windCompass(360)).toBe("N");
  });
});
