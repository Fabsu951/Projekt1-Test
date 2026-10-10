import { describe, expect, it } from "vitest";
import { quickObservation, toggleChoice } from "./quickObservation";

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
  });

  it("records 'no warning signs' too, and nothing before a choice", () => {
    expect(quickObservation(["inga_tecken"], "")).toEqual({
      type: "ovrigt",
      dangerSigns: [],
      description: "Snabbobservation: inga varningstecken.",
    });
    expect(quickObservation([], "text")).toBeNull();
  });

  it("never combines 'no warning signs' with a sign", () => {
    expect(toggleChoice(["wumpf"], "inga_tecken")).toEqual(["inga_tecken"]);
    expect(toggleChoice(["inga_tecken"], "wumpf")).toEqual(["wumpf"]);
    expect(toggleChoice(["wumpf", "snodrev"], "wumpf")).toEqual(["snodrev"]);
  });
});
