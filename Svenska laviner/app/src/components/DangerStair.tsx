import { t } from "../i18n";

/**
 * The danger scale as five rising steps with today's level filled – the
 * scale's own shape, so a level is always read against the whole scale.
 * Drawn in currentColor; the caller sets the colour.
 */
export default function DangerStair({ level, className }: { level: number; className?: string }) {
  const steps = [1, 2, 3, 4, 5];
  return (
    <svg
      className={className ? `danger-stair ${className}` : "danger-stair"}
      viewBox="0 0 54 30"
      role="img"
      aria-label={t("Nivå {level} av 5 på lavinskalan", { level })}
    >
      {steps.map((s) => {
        const h = 6 + s * 4.8;
        return (
          <rect
            key={s}
            x={(s - 1) * 11 + 0.75}
            y={30 - h + 0.75}
            width={9.5}
            height={h - 1.5}
            rx={1.5}
            fill={s === level ? "currentColor" : "none"}
            stroke="currentColor"
            strokeOpacity={s === level ? 1 : 0.45}
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
