import { useId } from "react";
import { imageUrl } from "../services/api";
import { levelFor } from "../data/levels";

/**
 * A profile picture in a frame that grows with experience: a plain ring for
 * newcomers, then bronze, silver (side notches), gold (a mountain crest),
 * platinum (crest and stars) and the veteran's double ring with snowflakes.
 * Original artwork drawn in SVG.
 */
export default function Avatar({
  name,
  avatarPath,
  xp = 0,
  size = 40,
}: {
  name: string;
  avatarPath: string | null | undefined;
  xp?: number;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const { level } = levelFor(xp);
  const tier = level.index;
  const [light, dark] = level.colors;
  const grad = `ring-${uid}`;
  const clip = `clip-${uid}`;
  const ringWidth = tier === 0 ? 3 : tier >= 3 ? 7 : 6;

  return (
    <svg
      className="avatar"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${name}, ${level.name}`}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="50" cy="54" r="33" />
        </clipPath>
      </defs>

      {tier === 5 && <circle cx="50" cy="54" r="46" fill="none" stroke={light} strokeOpacity="0.35" strokeWidth="3" />}

      <circle cx="50" cy="54" r="33" fill={initialsColor(name)} />
      {avatarPath ? (
        <image href={imageUrl(avatarPath)} x="17" y="21" width="66" height="66" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <text x="50" y="66" textAnchor="middle" className="avatar__initials">
          {initials(name)}
        </text>
      )}

      <circle cx="50" cy="54" r={36 + ringWidth / 2} fill="none" stroke={`url(#${grad})`} strokeWidth={ringWidth} />
      {tier === 5 && <circle cx="50" cy="54" r="45" fill="none" stroke={`url(#${grad})`} strokeWidth="2" />}

      {/* Silver and up: notches on the sides. */}
      {tier >= 2 && (
        <g fill={`url(#${grad})`}>
          <path d="M6 54 L14 49 L14 59 Z" />
          <path d="M94 54 L86 49 L86 59 Z" />
        </g>
      )}

      {/* Gold and up: a mountain crest on top. */}
      {tier >= 3 && (
        <path
          d="M30 17 L40 4 L46 11 L50 2 L54 11 L60 4 L70 17 Z"
          fill={`url(#${grad})`}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      )}

      {/* Platinum and up: stars below. */}
      {tier >= 4 && (
        <g fill={light} stroke={dark} strokeWidth="0.8">
          {[38, 50, 62].map((x) => (
            <path key={x} d={star(x, x === 50 ? 96 : 94, x === 50 ? 5 : 4)} />
          ))}
        </g>
      )}

      {/* Veteran: snowflakes on both sides. */}
      {tier === 5 &&
        [10, 90].map((x) => (
          <g key={x} stroke={light} strokeWidth="1.6" strokeLinecap="round">
            {[0, 60, 120].map((a) => (
              <line
                key={a}
                x1={x - 6 * Math.cos((a * Math.PI) / 180)}
                y1={24 - 6 * Math.sin((a * Math.PI) / 180)}
                x2={x + 6 * Math.cos((a * Math.PI) / 180)}
                y2={24 + 6 * Math.sin((a * Math.PI) / 180)}
              />
            ))}
          </g>
        ))}
    </svg>
  );
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** A calm background colour picked from the name, so letters-only avatars differ. */
function initialsColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 35%, 38%)`;
}
