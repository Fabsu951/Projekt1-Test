import { describe, expect, it } from "vitest";
import { QUICK_CHOICES, quickObservation, toggleChoice } from "./quickObservation";

describe("quick observations", () => {
  it("takes the type from the most serious sign and writes a description", () => {
    expect(quickObservation(["wumpf", "farska_laviner"], "")).toEqual({
      type: "lavin",
      dangerSigns: ["farska_laviner", "wumpf"],
      description: "Snabbobservation: Färska laviner, Wumpf / kollaps.",
    });
    expect(quickObservation(["snodrev"], "  Kraftigt på krönet ")?.description).toBe(
      "Snabbobservation: Pågående snödrev. Kraftigt på krönet"
    );
    expect(quickObservation([], "text")).toBeNull();
  });

  it("only offers things you see; 'no warning signs' is asked on the tour instead", () => {
    expect(QUICK_CHOICES.map((c) => c.label)).not.toContain("Inga varningstecken");
    expect(toggleChoice(["wumpf", "snodrev"], "wumpf")).toEqual(["snodrev"]);
    expect(toggleChoice(["snodrev"], "wumpf")).toEqual(["snodrev", "wumpf"]);
  });
});
