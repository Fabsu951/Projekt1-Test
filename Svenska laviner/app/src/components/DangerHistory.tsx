import type { HistoryDay } from "../services/avalancheService";
import { getDangerInfo } from "../data/dangerScale";

const WEEKDAY = new Intl.DateTimeFormat("sv-SE", { weekday: "short", timeZone: "UTC" });
const FULL_DATE = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Idag";
  if (date === addDays(today, 1)) return "I morgon";
  return WEEKDAY.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
}

interface Props {
  days: HistoryDay[];
  /** Today's date in Swedish time, YYYY-MM-DD. */
  today: string;
}

/** A strip of the last week's danger levels, oldest first; each day has its number and name, not just a colour. */
export default function DangerHistory({ days, today }: Props) {
  return (
    <ol className="danger-history">
      {days.map((day) => {
        const info = day.dangerLevel !== null ? getDangerInfo(day.dangerLevel) : null;
        const fullDate = FULL_DATE.format(new Date(`${day.date}T12:00:00Z`));
        const description = info ? `${info.level} ${info.label}` : "ingen prognos";
        return (
          <li key={day.date} className="danger-history__day" title={`${fullDate}: ${description}`}>
            <span className="danger-history__label">{dayLabel(day.date, today)}</span>
            {info ? (
              <span
                className="danger-history__level"
                style={{ backgroundColor: info.color, color: info.level >= 5 ? "#fff" : "#1a1a1a" }}
                aria-label={`${fullDate}: ${description}`}
              >
                {info.level}
              </span>
            ) : (
              <span className="danger-history__level danger-history__level--none" aria-label={`${fullDate}: ${description}`}>
                –
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
