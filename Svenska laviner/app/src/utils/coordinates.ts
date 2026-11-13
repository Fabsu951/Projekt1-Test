import { isEnglish } from "../i18n";

/**
 * SWEREF 99 TM (EPSG:3006), the grid Swedish rescue services and maps use:
 * transverse Mercator on GRS80, central meridian 15° E, scale 0.9996,
 * false easting 500 000 m – the same as UTM zone 33. WGS 84 (the phone's
 * GPS) and SWEREF 99 differ by well under a metre, so no datum shift.
 * Krüger's series; tested against proj4. Returns [north, east] in metres.
 */
export function toSweref99tm(lat: number, lon: number): [number, number] {
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
  return [Math.round(k0 * A * y), Math.round(500000 + k0 * A * x)];
}

const decimalMark = () => (isEnglish() ? "." : ",");

function hemi(value: number, pos: string, neg: string): string {
  return value >= 0 ? pos : neg;
}

/** "67.90123° N, 18.55012° E" – five decimals is about a metre. Always a point: that is how apps and 112 type it. */
export function formatDecimal(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${hemi(lat, "N", "S")}, ${Math.abs(lon).toFixed(5)}° ${hemi(lon, "E", "W")}`;
}

/** Degrees and decimal minutes, the form read aloud on the radio: "N 67° 54,074′  E 18° 33,007′". */
export function formatDegreesMinutes(lat: number, lon: number): string {
  const part = (value: number, pos: string, neg: string) => {
    const abs = Math.abs(value);
    let deg = Math.floor(abs);
    let min = Number(((abs - deg) * 60).toFixed(3));
    if (min >= 60) {
      deg += 1;
      min = 0;
    }
    return `${hemi(value, pos, neg)} ${deg}° ${min.toFixed(3).replace(".", decimalMark())}′`;
  };
  return `${part(lat, "N", "S")}  ${part(lon, "E", "W")}`;
}

/** "7 535 993" – grouped so it can be read out in threes. */
export function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** SWEREF 99 TM as "N 7 535 993  E 648 979". */
export function formatSweref(lat: number, lon: number): string {
  const [north, east] = toSweref99tm(lat, lon);
  return `N ${groupDigits(north)}  E ${groupDigits(east)}`;
}

/** Plain text to copy or send: every form, one per line. */
export function coordinateText(lat: number, lon: number): string {
  const [north, east] = toSweref99tm(lat, lon);
  return [
    `WGS 84: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    `WGS 84: ${formatDegreesMinutes(lat, lon).replace(/\s+/g, " ")}`,
    `SWEREF 99 TM: N ${north} E ${east}`,
  ].join("\n");
}
