import { useEffect, useRef, useState } from "react";
import { SLOPE_BANDS, slopeBand, type RouteSample } from "../utils/routePlan";

const HEIGHT = 120;
const PAD = { left: 54, right: 10, top: 22, bottom: 22 };

const km = (m: number) => `${(m / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`;

/**
 * Height along the route, the line coloured by the steepness of the ground
 * (same colours as the map). Hovering or dragging along it reports the
 * sample under the pointer so the map can show where that is.
 */
export default function ElevationProfile({
  samples,
  hoverIndex,
  onHover,
}: {
  samples: RouteSample[];
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const withHeight = samples.filter((s) => s.elevation !== null);
  if (withHeight.length < 2) return null;
  const total = samples[samples.length - 1].distM || 1;
  const heights = withHeight.map((s) => s.elevation!);
  let min = Math.min(...heights);
  let max = Math.max(...heights);
  if (max - min < 50) {
    const mid = (max + min) / 2;
    min = mid - 25;
    max = mid + 25;
  }
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (d: number) => PAD.left + (d / total) * plotW;
  const y = (h: number) => PAD.top + (1 - (h - min) / (max - min)) * plotH;

  const area =
    `M${x(withHeight[0].distM)},${y(min)} ` +
    withHeight.map((s) => `L${x(s.distM)},${y(s.elevation!)}`).join(" ") +
    ` L${x(withHeight[withHeight.length - 1].distM)},${y(min)} Z`;

  const segments = samples.slice(1).map((s, i) => {
    const a = samples[i];
    if (a.elevation === null || s.elevation === null) return null;
    const color = s.slope === null ? "var(--text-muted)" : SLOPE_BANDS[slopeBand(s.slope)].color;
    return <line key={i} x1={x(a.distM)} y1={y(a.elevation)} x2={x(s.distM)} y2={y(s.elevation)} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
  });

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const d = ((clientX - rect.left - PAD.left) / plotW) * total;
    let best = 0;
    samples.forEach((s, i) => {
      if (Math.abs(s.distM - d) < Math.abs(samples[best].distM - d)) best = i;
    });
    onHover(best);
  };

  const hovered = hoverIndex !== null ? samples[hoverIndex] : null;

  return (
    <div
      ref={box}
      className="elevation-profile"
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => onHover(null)}
    >
      <svg width={width} height={HEIGHT} role="img" aria-label={`Höjdprofil från ${Math.round(min)} till ${Math.round(max)} m över ${km(total)}`}>
        {[min, max].map((h) => (
          <g key={h}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(h)} y2={y(h)} className="elevation-profile__grid" />
            <text x={PAD.left - 6} y={y(h) + 4} textAnchor="end" className="elevation-profile__label">
              {Math.round(h)} m
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} className="elevation-profile__label">0</text>
        <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="elevation-profile__label">
          {km(total)}
        </text>
        <path d={area} className="elevation-profile__area" />
        {segments}
        {hovered && hovered.elevation !== null && (
          <g>
            <line x1={x(hovered.distM)} x2={x(hovered.distM)} y1={PAD.top} y2={PAD.top + plotH} className="elevation-profile__cursor" />
            <circle cx={x(hovered.distM)} cy={y(hovered.elevation)} r={4} className="elevation-profile__dot" />
          </g>
        )}
      </svg>
      {hovered && hovered.elevation !== null && (
        <div
          className="elevation-profile__tip"
          style={{ left: Math.min(width - 90, Math.max(90, x(hovered.distM))) }}
          role="status"
        >
          {km(hovered.distM)} · {Math.round(hovered.elevation)} m
          {hovered.slope !== null && ` · ${Math.round(hovered.slope)}°`}
        </div>
      )}
    </div>
  );
}
