import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  SystemBars: { setStyle: vi.fn(() => Promise.resolve()) },
  SystemBarsStyle: { Light: "LIGHT", Dark: "DARK" },
}));

import { applyAppearance, effectiveTheme, fieldMode, setFieldMode, setThemeChoice, themeChoice } from "./appearance";

describe("appearance", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.field;
  });

  it("follows the phone until a theme is chosen, and remembers the choice", () => {
    applyAppearance();
    expect(themeChoice()).toBe("auto");
    expect(document.documentElement.dataset.theme).toBeUndefined();

    setThemeChoice("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(effectiveTheme()).toBe("light");
    expect(localStorage.getItem("fjallkoll:theme")).toBe("light");

    setThemeChoice("auto");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("fjallkoll:theme")).toBeNull();
  });

  it("turns field mode on and off", () => {
    setFieldMode(true);
    expect(fieldMode()).toBe(true);
    expect(document.documentElement.dataset.field).toBe("on");
    setFieldMode(false);
    expect(document.documentElement.dataset.field).toBeUndefined();
  });
});
