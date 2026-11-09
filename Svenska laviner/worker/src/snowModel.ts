import { stockholmDate } from "./model";

// Modelled snow on the mountain from seNorge (NVE and MET Norway), through
// NVE's open GridTimeSeries API (no key): one 1 × 1 km cell per request,
// one value per day, https://gts.nve.no/api/GridTimeSeries/{x}/{y}/{from}/{to}/{theme}.json
// with x/y in UTM zone 33 (ETRS89). NVE (Rune Engeset, 9 Nov 2026) OK'd the
// use and said the simulation is NOT evaluated on the Swedish side – the
// app says so wherever it shows these numbers.
//
// Snow varies a lot with height (Kebnekaise 9 Nov 2026: 0–42 cm within
// 10 km), so each area gets three fixed cells at different heights instead
// of one number; the cell's own height comes back in the answer. The cells
// were picked from a 5 × 5 survey around each area centre (one-off
// GitHub Actions check, 2026-11-09), plus known high ground in Jämtland
// and Härjedalen where the centre is low.

export const SENORGE_BASE = "https://gts.nve.no/api/GridTimeSeries";
export const SENORGE_PAGE = "https://www.senorge.no";

export const SNOW_CELLS: Record<string, Array<[number, number]>> = {
  kebnekaisefjallen: [[67.9, 18.55], [67.96, 18.55], [67.84, 18.69]],
  riksgransfjallen: [[68.54, 18.13], [68.36, 17.99], [68.42, 18.13]],
  "vastra-vindelfjallen": [[65.94, 15.22], [65.88, 15.08], [65.76, 15.08]],
  "sodra-lapplandsfjallen": [[65.4, 14.42], [65.22, 14.42], [65.28, 14.7]],
  "sodra-jamtlandsfjallen": [[63.43, 13.09], [63.02, 12.3], [63.4, 13.08]],
  "vastra-harjedalsfjallen": [[62.92, 12.46], [62.78, 12.52], [62.78, 12.8]],
};

/** WGS84/ETRS89 → UTM zone 33 (GRS80), Krüger's series; well under a metre in Scandinavia. */
export function toUtm33(lat: number, lon: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const lon0 = (15 * Math.PI) / 180;
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64);
  const alpha = [n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16, (13 * n ** 2) / 48 - (3 * n ** 3) / 5, (61 * n ** 3) / 240];
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180 - lon0;
  const e = Math.sqrt(f * (2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lambda));
  const eta = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let x = eta;
  let y = xi;
  for (let j = 1; j <= 3; j++) {
    x += alpha[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    y += alpha[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  return [Math.round(500000 + k0 * A * x), Math.round(k0 * A * y)];
}

interface GtsAnswer {
  NoDataValue?: number;
  Altitude?: number;
  Unit?: string;
  Data?: unknown[];
}

export interface SnowCell {
  lat: number;
  lon: number;
  /** The model cell's height, m above sea level. */
  altitude: number | null;
  /** The day the numbers are for (Swedish date, YYYY-MM-DD). */
  date: string;
  depthCm: number | null;
  /** Change in depth over the 7 days before `date`. */
  weekChangeCm: number | null;
  newSnow3dCm: number | null;
}

export interface SnowModel {
  regionId: string;
  cells: SnowCell[];
  source: string;
  fetchedAt: string;
}

const DAYS_BACK = 7;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
}

/** Numbers in the answer, nodata (and anything odd) as null; index 0 = the requested start day. */
export function readSeries(answer: GtsAnswer): Array<number | null> {
  const nodata = answer.NoDataValue;
  return (answer.Data ?? []).map((v) => (typeof v === "number" && Number.isFinite(v) && v !== nodata && v >= 0 && v < 5000 ? v : null));
}

/** One cell's numbers from its depth and 3-day new-snow series (both starting `from`). */
export function cellFromSeries(
  lat: number,
  lon: number,
  from: string,
  depth: GtsAnswer,
  newSnow: GtsAnswer | null,
): SnowCell | null {
  const sd = readSeries(depth);
  // The latest day with a depth, at most today (the series can run into forecast days).
  let i = Math.min(sd.length - 1, DAYS_BACK);
  while (i >= 0 && sd[i] === null) i--;
  if (i < 0) return null;
  const week = sd[i - DAYS_BACK] ?? null;
  const fsw = newSnow ? readSeries(newSnow) : [];
  const round = (v: number | null) => (v === null ? null : Math.round(v));
  return {
    lat,
    lon,
    altitude: typeof depth.Altitude === "number" ? depth.Altitude : null,
    date: addDays(from, i),
    depthCm: round(sd[i]),
    weekChangeCm: week === null ? null : Math.round((sd[i] as number) - week),
    newSnow3dCm: round(fsw[i] ?? null),
  };
}

async function getSeries(fetcher: typeof fetch, lat: number, lon: number, from: string, to: string, theme: string): Promise<GtsAnswer | null> {
  const [x, y] = toUtm33(lat, lon);
  const res = await fetcher(`${SENORGE_BASE}/${x}/${y}/${from}/${to}/${theme}.json`, {
    headers: { "User-Agent": "Snolage/1.0 (+https://snolage.se)", Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  // 400: outside the model grid.
  if (!res.ok) return null;
  return (await res.json()) as GtsAnswer;
}

/** The area's three cells, highest first; cells without data are left out. */
export async function fetchSnowModel(regionId: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<SnowModel | null> {
  const cells = SNOW_CELLS[regionId];
  if (!cells) return null;
  const to = stockholmDate(now);
  const from = addDays(to, -DAYS_BACK);
  const results = await Promise.all(
    cells.map(async ([lat, lon]) => {
      const [depth, newSnow] = await Promise.all([
        getSeries(fetcher, lat, lon, from, to, "sd").catch(() => null),
        getSeries(fetcher, lat, lon, from, to, "sdfsw3d").catch(() => null),
      ]);
      return depth ? cellFromSeries(lat, lon, from, depth, newSnow) : null;
    }),
  );
  const found = results.filter((c): c is SnowCell => c !== null).sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0));
  return { regionId, cells: found, source: SENORGE_PAGE, fetchedAt: now.toISOString() };
}
