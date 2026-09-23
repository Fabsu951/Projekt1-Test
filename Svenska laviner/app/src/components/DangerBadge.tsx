import { getDangerInfo } from "../data/dangerScale";

interface Props {
  level: number;
  size?: "small" | "large";
}

export default function DangerBadge({ level, size = "small" }: Props) {
  const info = getDangerInfo(level);
  const isDark = info.level >= 5;

  return (
    <span
      className={`danger-badge danger-badge--${size}`}
      style={{ backgroundColor: info.color, color: isDark ? "#fff" : "#1a1a1a" }}
    >
      <strong>{info.level}</strong> {info.label}
    </span>
  );
}
