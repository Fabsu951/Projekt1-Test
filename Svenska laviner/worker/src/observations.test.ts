import { describe, expect, it } from "vitest";
import { cleanDangerSigns, parseSnowDepth } from "./observations";
import { HttpError } from "./http";

describe("cleanDangerSigns", () => {
  it("keeps known signs once each, in a fixed order", () => {
    expect(cleanDangerSigns(["wumpf", "farska_laviner", "wumpf", "hittepå", 3])).toEqual(["farska_laviner", "wumpf"]);
    expect(cleanDangerSigns([])).toEqual([]);
  });
});

describe("parseSnowDepth", () => {
  it("treats an empty field as not given", () => {
    expect(parseSnowDepth("")).toBeNull();
  });

  it("accepts whole centimetres within range", () => {
    expect(parseSnowDepth("0")).toBe(0);
    expect(parseSnowDepth("145")).toBe(145);
  });

  it("rejects anything else with a message for the user", () => {
    for (const bad of ["-5", "12.5", "abc", "5000"]) {
      expect(() => parseSnowDepth(bad), bad).toThrow(HttpError);
    }
  });
});
