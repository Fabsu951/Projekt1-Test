// Snöläge's own map of possible avalanche runout zones for the Swedish
// mountains, where no official one exists (NVE's "Bratthet med utløp" stops
// at the border). An alpha-angle model on a height grid:
//
// 1. Release cells: ground between 30° and 60° (snow slides off steeper rock).
// 2. From every release cell an "energy line" falls with the angle alpha:
//    after a horizontal path length L it is at  z_release − tan(alpha)·L.
//    A cell lies in the runout zone when that line is still above the ground.
// 3. The path follows the terrain downhill (to neighbours that fall at least
//    SPREAD × the steepest drop, so it doesn't drift sideways along a slope);
//    on flat ground (lakes, valley floors) it spreads in every direction and
//    may run a little uphill.
//
// Three angles give three zones (short, medium, long reach); the angles are
// calibrated against NVE's map on the Norwegian side (import-runout.ts
// --mode calibrate). A cell's value is how many of the zones reach it:
// 3 = even the short reach, 1 = only the long reach, 0 = none. Steep ground
// itself (≥ 30°) is left out – the slope map shows it.
//
// It is a terrain model, not an avalanche forecast: no snow, wind or forest.

export interface HeightGrid {
  width: number;
  height: number;
  /** Metres above sea level, row by row from the north; NaN = no data. */
  z: Float32Array;
  /** Ground size of a cell in metres, per row (Web Mercator cells shrink northwards). */
  cellSize: (row: number) => number;
}

export interface RunoutOptions {
  /** Alpha angles in degrees, any order. */
  alphas: number[];
  releaseMin?: number;
  releaseMax?: number;
  /** A neighbour must fall at least this share of the steepest drop to be followed. */
  spread?: number;
  /** Below this gradient (tan) the ground counts as flat: every neighbour is followed. */
  flatTan?: number;
  /** On flat ground the path may climb this many metres per step (runup, DEM noise). */
  runup?: number;
}

export const DEFAULT_ALPHAS = [30, 25, 20];
const DEFAULTS = { releaseMin: 30, releaseMax: 60, spread: 0.7, flatTan: Math.tan((3 * Math.PI) / 180), runup: 0.3 };

const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
const DIAG = [true, false, true, false, false, true, false, true];

/** Slope in degrees (Horn's method); NaN at the edge and next to missing heights. */
export function slopeGrid(g: HeightGrid): Float32Array {
  const { width: w, height: h, z } = g;
  const out = new Float32Array(w * h).fill(NaN);
  for (let y = 1; y < h - 1; y++) {
    const c = g.cellSize(y);
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = z[i - w - 1], b = z[i - w], cc = z[i - w + 1];
      const d = z[i - 1], f = z[i + 1];
      const gg = z[i + w - 1], hh = z[i + w], ii = z[i + w + 1];
      const dzdx = (cc + 2 * f + ii - (a + 2 * d + gg)) / (8 * c);
      const dzdy = (gg + 2 * hh + ii - (a + 2 * b + cc)) / (8 * c);
      const s = Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI);
      out[i] = s; // NaN propagates from missing heights
    }
  }
  return out;
}

/** A binary max-heap of cell indices keyed by energy-line height. */
class MaxHeap {
  keys = new Float64Array(1024);
  ids = new Int32Array(1024);
  size = 0;

  push(key: number, id: number) {
    if (this.size === this.keys.length) {
      const k = new Float64Array(this.size * 2);
      k.set(this.keys);
      this.keys = k;
      const d = new Int32Array(this.size * 2);
      d.set(this.ids);
      this.ids = d;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] >= key) break;
      this.keys[i] = this.keys[p];
      this.ids[i] = this.ids[p];
      i = p;
    }
    this.keys[i] = key;
    this.ids[i] = id;
  }

  /** Removes the top; read keys[0]/ids[0] first. */
  pop() {
    const n = --this.size;
    const key = this.keys[n];
    const id = this.ids[n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && this.keys[c + 1] > this.keys[c]) c++;
      if (this.keys[c] <= key) break;
      this.keys[i] = this.keys[c];
      this.ids[i] = this.ids[c];
      i = c;
    }
    this.keys[i] = key;
    this.ids[i] = id;
  }
}

/**
 * For each cell, the neighbours a sliding mass would follow (bit k = neighbour
 * k in DX/DY order). Computed once, shared by all alpha angles.
 */
export function flowNeighbours(g: HeightGrid, opts: RunoutOptions = { alphas: [] }): Uint8Array {
  const { spread, flatTan, runup } = { ...DEFAULTS, ...opts };
  const { width: w, height: h, z } = g;
  const out = new Uint8Array(w * h);
  const grad = new Float64Array(8);
  for (let y = 1; y < h - 1; y++) {
    const c = g.cellSize(y);
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const zc = z[i];
      if (Number.isNaN(zc)) continue;
      let gmax = -Infinity;
      for (let k = 0; k < 8; k++) {
        const zn = z[i + DY[k] * w + DX[k]];
        grad[k] = Number.isNaN(zn) ? -Infinity : (zc - zn) / (DIAG[k] ? c * Math.SQRT2 : c);
        if (grad[k] > gmax) gmax = grad[k];
      }
      let mask = 0;
      if (gmax < flatTan) {
        for (let k = 0; k < 8; k++) {
          const zn = z[i + DY[k] * w + DX[k]];
          if (!Number.isNaN(zn) && zn <= zc + runup) mask |= 1 << k;
        }
      } else {
        for (let k = 0; k < 8; k++) if (grad[k] > 0 && grad[k] >= spread * gmax) mask |= 1 << k;
      }
      out[i] = mask;
    }
  }
  return out;
}

/** Cells reached by the energy line of one alpha angle (1 = reached). */
export function reachedCells(g: HeightGrid, slope: Float32Array, flow: Uint8Array, alpha: number, opts: RunoutOptions = { alphas: [] }): Uint8Array {
  const { releaseMin, releaseMax } = { ...DEFAULTS, ...opts };
  const { width: w, height: h, z } = g;
  const tan = Math.tan((alpha * Math.PI) / 180);
  // Float64: a Float32 copy could round above the queued key and skip the cell.
  const energy = new Float64Array(w * h).fill(-Infinity);
  const done = new Uint8Array(w * h);
  const heap = new MaxHeap();
  for (let i = 0; i < w * h; i++) {
    const s = slope[i];
    if (s >= releaseMin && s <= releaseMax) {
      energy[i] = z[i];
      heap.push(z[i], i);
    }
  }
  while (heap.size > 0) {
    const e = heap.keys[0];
    const i = heap.ids[0];
    heap.pop();
    if (done[i] || e < energy[i]) continue;
    done[i] = 1;
    const mask = flow[i];
    if (!mask) continue;
    const y = (i / w) | 0;
    const c = g.cellSize(y);
    for (let k = 0; k < 8; k++) {
      if (!(mask & (1 << k))) continue;
      const n = i + DY[k] * w + DX[k];
      if (done[n]) continue;
      const en = e - tan * (DIAG[k] ? c * Math.SQRT2 : c);
      if (en < z[n] || en <= energy[n]) continue;
      energy[n] = en;
      heap.push(en, n);
    }
  }
  return done;
}

/**
 * Runout classes per cell: the number of zones (alpha angles) that reach it,
 * 0 on steep ground (≥ releaseMin) and where nothing reaches.
 */
export function runoutClasses(g: HeightGrid, opts: RunoutOptions): Uint8Array {
  const slope = slopeGrid(g);
  const flow = flowNeighbours(g, opts);
  return classesFrom(g, slope, flow, opts);
}

export function classesFrom(g: HeightGrid, slope: Float32Array, flow: Uint8Array, opts: RunoutOptions): Uint8Array {
  const { releaseMin } = { ...DEFAULTS, ...opts };
  const out = new Uint8Array(g.width * g.height);
  for (const alpha of opts.alphas) {
    const reached = reachedCells(g, slope, flow, alpha, opts);
    for (let i = 0; i < out.length; i++) if (reached[i]) out[i]++;
  }
  for (let i = 0; i < out.length; i++) if (!(slope[i] < releaseMin)) out[i] = 0;
  return out;
}
