import { describe, expect, it } from "vitest";
import { getDangerInfo } from "./dangerScale";

describe("getDangerInfo", () => {
  it("returns the matching level's info", () => {
    expect(getDangerInfo(3).label).toBe("Betydande fara");
  });

  it("clamps below the valid range to level 1", () => {
    expect(getDangerInfo(0).level).toBe(1);
    expect(getDangerInfo(-5).level).toBe(1);
  });

  it("clamps above the valid range to level 5", () => {
    expect(getDangerInfo(6).level).toBe(5);
    expect(getDangerInfo(100).level).toBe(5);
  });
});
