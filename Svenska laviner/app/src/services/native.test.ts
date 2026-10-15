import { describe, expect, it } from "vitest";
import { insetsFromSystem } from "./native";

describe("insetsFromSystem", () => {
  it("sees that Android left room for the status and navigation bars", () => {
    // Galaxy S22: 832 px screen, 29 px status bar, 48 px buttons.
    expect(insetsFromSystem(832, 755)).toBe(true);
  });

  it("leaves edge-to-edge pages to pad for the bars themselves", () => {
    expect(insetsFromSystem(832, 832)).toBe(false);
    // Some phones count the screen without the navigation bar.
    expect(insetsFromSystem(784, 832)).toBe(false);
  });
});
