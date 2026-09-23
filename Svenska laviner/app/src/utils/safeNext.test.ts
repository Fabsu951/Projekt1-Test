import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps in-app paths", () => {
    expect(safeNext("/observationer/ny")).toBe("/observationer/ny");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(safeNext("https://evil.example")).toBe("/profil");
    expect(safeNext("//evil.example")).toBe("/profil");
    expect(safeNext(null)).toBe("/profil");
  });
});
