import type { ReactNode } from "react";
import type { AvalancheProblem } from "../types/avalanche";

// Original pictograms (not EAWS's own artwork): each is a tilted
// cross-section of a snow slope, drawn flat in a rotated frame, with the
// problem's distinguishing detail — falling flakes, wind, a buried weak
// layer, melt water, or a glide crack down to the ground.

const GROUND = "#5b6875";
const OLD_SNOW = "#c9d4de";
const NEW_SNOW = "#ffffff";
const ICE = "#7cc7ec";
const SIGNAL = "#ff9f43";

/** Everything inside is drawn with the snow surface horizontal, then tilted into a slope. */
function Slope({ children }: { children: ReactNode }) {
  return <g transform="translate(0 -5) rotate(-30 24 36)">{children}</g>;
}

function Ground() {
  return <rect x={-30} y={36} width={110} height={40} fill={GROUND} />;
}

function Flake({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={NEW_SNOW} strokeWidth={1.5} strokeLinecap="round">
      <line x1={x - 3.2} y1={y} x2={x + 3.2} y2={y} />
      <line x1={x - 1.6} y1={y - 2.8} x2={x + 1.6} y2={y + 2.8} />
      <line x1={x - 1.6} y1={y + 2.8} x2={x + 1.6} y2={y - 2.8} />
    </g>
  );
}

function Drop({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y - 4} Q${x + 3.2} ${y + 0.8} ${x} ${y + 2.6} Q${x - 3.2} ${y + 0.8} ${x} ${y - 4} Z`} fill={ICE} />;
}

const ICONS: Record<AvalancheProblem, ReactNode> = {
  nysno: (
    <>
      <Slope>
        <Ground />
        <rect x={-30} y={29} width={110} height={7} fill={OLD_SNOW} />
        <rect x={-30} y={23} width={110} height={6} fill={NEW_SNOW} />
      </Slope>
      <Flake x={8} y={8} />
      <Flake x={17} y={15} />
      <Flake x={25} y={6} />
    </>
  ),
  vindpack: (
    <>
      <Slope>
        <Ground />
        <rect x={-30} y={29} width={110} height={7} fill={OLD_SNOW} />
        <rect x={-30} y={23} width={110} height={6} fill="#a9d6ee" />
        <line x1={20} y1={23} x2={20} y2={29} stroke={GROUND} strokeWidth={1.2} />
      </Slope>
      <g stroke={ICE} strokeWidth={1.8} strokeLinecap="round" fill="none">
        <path d="M4 8 H18 q4 0 4 -3" />
        <path d="M4 13 H24" />
        <path d="M7 18 H16 q3 0 3 3" />
      </g>
    </>
  ),
  gammal_svag_lagring: (
    <Slope>
      <Ground />
      <rect x={-30} y={16} width={110} height={20} fill={OLD_SNOW} />
      <line x1={-30} y1={22} x2={80} y2={22} stroke="#9aa9b7" strokeWidth={0.8} />
      <line x1={-30} y1={32} x2={80} y2={32} stroke={SIGNAL} strokeWidth={2} strokeDasharray="3 2" />
    </Slope>
  ),
  vatsno: (
    <>
      <Slope>
        <Ground />
        <rect x={-30} y={25} width={110} height={11} fill="#b7cfdd" />
      </Slope>
      <circle cx={10} cy={9} r={5} fill={SIGNAL} />
      <Drop x={20} y={14} />
      <Drop x={27} y={8} />
    </>
  ),
  glidlavin: (
    <Slope>
      <Ground />
      <rect x={-30} y={24} width={110} height={12} fill={OLD_SNOW} />
      <path d="M18 24 L22 24 L21 36 L19.5 36 Z" fill={GROUND} />
      <g stroke={SIGNAL} strokeWidth={1.6} strokeLinecap="round" fill="none">
        <path d="M14 20 H6" />
        <path d="M9 17.5 L6 20 L9 22.5" />
      </g>
    </Slope>
  ),
};

interface Props {
  problem: AvalancheProblem;
  size?: number;
}

export default function ProblemIcon({ problem, size = 48 }: Props) {
  return (
    <span className="problem-icon" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        {ICONS[problem]}
      </svg>
    </span>
  );
}
