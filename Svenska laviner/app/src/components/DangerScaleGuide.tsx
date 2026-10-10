import { DANGER_SCALE, DANGER_SCALE_SOURCES } from "../data/dangerScale";
import SourceList from "./SourceList";
import { t } from "../i18n";

export default function DangerScaleGuide({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <div className="danger-scale-guide">
      {showHeading && <h3>{t("Lavinskalan")}</h3>}
      {DANGER_SCALE.map((info) => (
        <div key={info.level} className="danger-scale-guide__row">
          <span
            className="danger-scale-guide__swatch"
            style={{ backgroundColor: info.color, color: info.level >= 5 ? "#fff" : undefined }}
          >
            {info.level}
          </span>
          <div>
            <strong>{info.label}</strong>
            <p>{info.description}</p>
          </div>
        </div>
      ))}
      <SourceList sources={DANGER_SCALE_SOURCES} />
    </div>
  );
}
