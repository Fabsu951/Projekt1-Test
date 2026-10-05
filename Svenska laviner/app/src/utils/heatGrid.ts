import type { TourLine } from "../types/tour";

// Counts how many different tours pass through each square of a grid laid
// over the map, so the heatmap can colour a route by how many people have
// skied it. Squares are measured in Web Mercator metres (the map's own
// projection) and sized to a fixed number of screen pixels, so tours a
// little apart on screen count as the same route at every zoom level.

const EARTH_RADIUS = 6378137;
/** Width of a grid square on screen; tracks closer than this count as one route. */
const CELL_PX = 12;

type Projected = [number, number];

function project([lat, lon]: [number, number]): Projected {
  const x = (EARTH_RADIUS * lon * Math.PI) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

/** Grid square size in Mercator metres for a map zoom level. */
export function cellSizeM(zoom: number): number {
  return (CELL_PX * (2 * Math.PI * EARTH_RADIUS)) / (256 * 2 ** zoom);
}

export interface HeatGrid {
  cellM: number;
  /** Tour ids per grid square, each tour at most once. */
  cells: Map<string, number[]>;
}

function cellKey([x, y]: Projected, cellM: number): string {
  return `${Math.floor(x / cellM)}:${Math.floor(y / cellM)}`;
}

/** Every grid square each tour passes through (sampled every half square). */
export function buildHeatGrid(lines: TourLine[], cellM: number): HeatGrid {
  const cells = new Map<string, number[]>();
  for (const line of lines) {
    const seen = new Set<string>();
    const visit = (p: Projected) => {
      const key = cellKey(p, cellM);
      if (seen.has(key)) return;
      seen.add(key);
      const ids = cells.get(key);
      if (ids) ids.push(line.id);
      else cells.set(key, [line.id]);
    };
    const pts = line.points.map(project);
    pts.forEach((p, i) => {
      visit(p);
      const next = pts[i + 1];
      if (!next) return;
      const steps = Math.ceil(Math.hypot(next[0] - p[0], next[1] - p[1]) / (cellM / 2));
      for (let s = 1; s < steps; s++) {
        visit([p[0] + ((next[0] - p[0]) * s) / steps, p[1] + ((next[1] - p[1]) * s) / steps]);
      }
    });
  }
  return { cellM, cells };
}

/** Tour ids in the grid square at a map point. */
export function toursAt(grid: HeatGrid, point: [number, number]): number[] {
  return grid.cells.get(cellKey(project(point), grid.cellM)) ?? [];
}

/**
 * Tour ids where a tapped line passes: the square under the tap, or, when a
 * tap just misses it, the neighbouring square the line runs through.
 */
export function toursNear(grid: HeatGrid, point: [number, number], lineId: number): number[] {
  const [x, y] = project(point);
  let best: number[] = [];
  for (const dx of [0, -1, 1]) {
    for (const dy of [0, -1, 1]) {
      const ids = grid.cells.get(cellKey([x + dx * grid.cellM, y + dy * grid.cellM], grid.cellM)) ?? [];
      if (ids.includes(lineId) && ids.length > best.length) best = ids;
      if (dx === 0 && dy === 0 && best.length) return best;
    }
  }
  return best.length ? best : [lineId];
}

/** Count bands shown in the legend, lowest first. */
export const HEAT_BANDS: Array<{ min: number; label: string; color: string; weight: number }> = [
  { min: 1, label: "1", color: "#f7a35c", weight: 3 },
  { min: 2, label: "2–3", color: "#ec6a1f", weight: 4 },
  { min: 4, label: "4–9", color: "#c2410c", weight: 5 },
  { min: 10, label: "10+", color: "#7c2d12", weight: 6 },
];

export function heatBand(count: number): number {
  let band = 0;
  HEAT_BANDS.forEach((b, i) => {
    if (count >= b.min) band = i;
  });
  return band;
}

export interface HeatRun {
  lineId: number;
  band: number;
  positions: Array<[number, number]>;
}

/**
 * Splits each tour into stretches with the same count band (judged at the
 * middle of every segment), so a route lights up only where it is shared.
 * Sorted lowest band first so the busiest stretches are drawn on top.
 */
export function heatRuns(lines: TourLine[], grid: HeatGrid): HeatRun[] {
  const runs: HeatRun[] = [];
  for (const line of lines) {
    let current: HeatRun | null = null;
    for (let i = 0; i < line.points.length - 1; i++) {
      const a = line.points[i];
      const b = line.points[i + 1];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const band = heatBand(Math.max(1, toursAt(grid, mid).length));
      if (current && current.band === band) {
        current.positions.push(b);
      } else {
        current = { lineId: line.id, band, positions: [a, b] };
        runs.push(current);
      }
    }
  }
  return runs.sort((x, y) => x.band - y.band);
}
