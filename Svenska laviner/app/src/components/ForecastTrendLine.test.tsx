import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForecastTrendLine from "./ForecastTrendLine";
import ForecastNotes from "./ForecastNotes";
import { toNote, toTrend } from "../services/avalancheService";

describe("ForecastTrendLine", () => {
  it("shows the expected level for the next day and whether it rises", () => {
    render(<ForecastTrendLine trend={{ date: "2027-02-20", dangerLevel: 3, label: "Betydande lavinfara", text: "Ny snö och vind." }} today={2} />);
    expect(screen.getByText(/Förväntad utveckling lör 20 feb/)).toBeInTheDocument();
    expect(screen.getByText(/Betydande fara/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lavinfaran ökar")).toHaveTextContent("↑");
    expect(screen.getByText("Ny snö och vind.")).toBeInTheDocument();
  });

  it("shows only the label when there's no level", () => {
    render(<ForecastTrendLine trend={{ date: "2027-02-20", dangerLevel: null, label: "Ej bedömd lavinfara", text: null }} today={2} />);
    expect(screen.getByText("Ej bedömd lavinfara")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Lavinfaran/)).toBeNull();
  });
});

describe("worker data for trend and notes", () => {
  it("never turns anything but 1–5 into a level, and drops non-web links", () => {
    expect(toTrend({ date: "2027-02-20", danger: 6, label: "Vårförhållanden" })).toEqual({
      date: "2027-02-20",
      dangerLevel: null,
      label: "Vårförhållanden",
      text: null,
    });
    expect(toTrend({ date: "x", danger: 2 })).toBeNull();
    expect(toNote({ text: "Rapport", link: "javascript:alert(1)" })).toMatchObject({ link: null });
    expect(toNote({ text: "  " })).toBeNull();
  });

  it("folds the field report and weather under their titles", () => {
    render(
      <ForecastNotes
        forecast={{
          regionId: "x",
          status: "published",
          dangerLevel: 2,
          problems: [],
          headline: null,
          mainMessage: null,
          publishedText: null,
          sourceUrl: "https://www.lavinprognoser.se/",
          snow: { title: "Rapport från området", text: "Lavinaktivitet\nInga nya laviner.", link: null, linkText: null },
          weather: { title: "Fjällväderprognos", text: "Mulet.", link: "https://www.smhi.se", linkText: "SMHI" },
        }}
      />
    );
    expect(screen.getByText("Rapport från området")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SMHI ↗" })).toHaveAttribute("href", "https://www.smhi.se");
  });
});
