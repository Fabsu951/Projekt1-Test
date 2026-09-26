import { describe, expect, it } from "vitest";
import { cleanFavorites } from "./favorites";

describe("cleanFavorites", () => {
  it("keeps known region ids once each, in order", () => {
    expect(cleanFavorites(["riksgransfjallen", "okand", "kebnekaisefjallen", "riksgransfjallen", 7])).toEqual([
      "riksgransfjallen",
      "kebnekaisefjallen",
    ]);
  });

  it("treats anything but a list as no favourites", () => {
    expect(cleanFavorites("kebnekaisefjallen")).toEqual([]);
    expect(cleanFavorites(null)).toEqual([]);
  });
});
