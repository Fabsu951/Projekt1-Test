import { describe, expect, it } from "vitest";
import { resetEmail, verificationEmail } from "./email";
import { compass, dayName, problemName } from "./lang";
import { changeMessage } from "./push";

describe("texts in the reader's language", () => {
  it("writes danger-level notices in Swedish or English", () => {
    const change = { regionId: "kebnekaisefjallen", date: "2026-02-14", from: 2, to: 3 };
    expect(changeMessage(change, "2026-02-13")).toMatchObject({
      title: "Kebnekaisefjällen: 3 Betydande fara",
      body: "Farograden i morgon har höjts från 2 Måttlig fara.",
    });
    expect(changeMessage(change, "2026-02-14", "en")).toMatchObject({
      title: "Kebnekaisefjällen: 3 Considerable",
      body: "The danger level today has been raised from 2 Moderate.",
    });
  });

  it("writes emails in the account's language", () => {
    expect(verificationEmail("a@test", "Anna", "https://x", "en").subject).toBe("Confirm your email address – Snöläge");
    expect(resetEmail("a@test", "Anna", "https://x").subject).toBe("Återställ ditt lösenord – Snöläge");
    expect(resetEmail("a@test", "Anna", "https://x", "en").html).toContain('lang="en"');
  });

  it("names days, problems and compass points", () => {
    expect(dayName("2026-02-14", "en")).toBe("Saturday 14 Feb");
    expect(problemName({ type: "bestaende-flak", name: "Bestående flak" }, "en")).toBe("Persistent weak layers");
    expect(problemName({ type: "okand", name: "Okänt flak" }, "en")).toBe("Okänt flak");
    expect(compass("SV", "en")).toBe("SW");
  });
});
