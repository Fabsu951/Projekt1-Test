import { DANGER_SCALE, DANGER_SCALE_SOURCES } from "../data/dangerScale";
import SourceList from "./SourceList";

export default function DangerScaleGuide() {
  return (
    <div className="danger-scale-guide">
      <h3>Lavinskalan</h3>
      {DANGER_SCALE.map((info) => (
        <div key={info.level} className="danger-scale-guide__row">
          <span
            className="danger-scale-guide__swatch"
            style={{ backgroundColor: info.color }}
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
