import { describe, expect, it } from "vitest";
import { parseForecastHtml } from "./parse";

/**
 * These fixtures are hand-written approximations of what the site's markup
 * is expected to look like, based on the patterns documented by the
 * "toppturvarsel" open-source scraper for the same source. They have not
 * been validated against the live site (blocked from this environment) —
 * treat this as a regression test for the parsing *logic*, not proof the
 * regexes match production markup. Re-check against lavinprognoser.se the
 * first time a real forecast is published this season and adjust if needed.
 */

describe("parseForecastHtml", () => {
  it("parses a danger level from an alt-text risk icon", () => {
    const html = `
      <div class="risk-icon"><img alt="Risk 3 - Betydande lavinfara" src="/icons/risk3.svg" /></div>
      <p>Huvudbudskap: Svag lagring i norostlig exponering ovan trädgränsen.</p>
      <p>Publicerad: 22 september 2026, 18:00</p>
    `;
    const result = parseForecastHtml(html);
    expect(result.assessed).toBe(true);
    expect(result.danger).toBe(3);
    expect(result.confidence).toBe("parsed");
    expect(result.headline).toContain("Svag lagring");
    expect(result.publishedText).toContain("22 september 2026");
  });

  it("falls back to Swedish danger words when no alt-text icon is found", () => {
    const html = `<p>Idag råder måttlig lavinfara i regionen.</p>`;
    const result = parseForecastHtml(html);
    expect(result.danger).toBe(2);
    expect(result.confidence).toBe("parsed");
  });

  it("detects an explicit 'not assessed' state without guessing a level", () => {
    const html = `<p>Området är för närvarande Ej bedömd.</p>`;
    const result = parseForecastHtml(html);
    expect(result.danger).toBeNull();
    expect(result.notAssessed).toBe(true);
    expect(result.confidence).toBe("explicit-none");
  });

  it("detects the season-over state without guessing a level", () => {
    const html = `<p>Prognossäsongen är avslutad för i år.</p>`;
    const result = parseForecastHtml(html);
    expect(result.danger).toBeNull();
    expect(result.seasonOver).toBe(true);
    expect(result.confidence).toBe("explicit-none");
  });

  it("returns confidence 'none' rather than guessing when nothing matches", () => {
    const html = `<p>Helt oväntat sidinnehåll utan några kända mönster.</p>`;
    const result = parseForecastHtml(html);
    expect(result.danger).toBeNull();
    expect(result.assessed).toBe(false);
    expect(result.confidence).toBe("none");
  });
});
