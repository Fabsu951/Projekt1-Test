import { getDangerInfo } from "../data/dangerScale";
import type { AvalancheForecast } from "../types/avalanche";
import { forecastLabel } from "../utils/forecastLabel";
import DangerStair from "./DangerStair";
import { t } from "../i18n";

/**
 * The top of an area page: today's official level as a band in its danger
 * colour, with the scale beside it. Without a published level it is a
 * quiet band saying why – never a guessed level.
 */
export default function DangerHero({ forecast }: { forecast: AvalancheForecast }) {
  if (forecast.dangerLevel === null) {
    return (
      <div className="danger-hero danger-hero--none">
        <span className="danger-hero__label">{forecastLabel(forecast)}</span>
      </div>
    );
  }
  const info = getDangerInfo(forecast.dangerLevel);
  return (
    <div
      className={`danger-hero danger-hero--${info.level}`}
      style={{ background: info.color, color: info.level >= 5 ? "#ffffff" : "#17222b" }}
    >
      <span className="danger-hero__number" aria-hidden="true">
        {info.level}
      </span>
      <span className="danger-hero__text">
        <span className="danger-hero__label">{info.label}</span>
        <span className="danger-hero__sub">{t("Lavinfara enligt dagens prognos")}</span>
      </span>
      <DangerStair level={info.level} className="danger-hero__stair" />
    </div>
  );
}
