/** A route's shape as a small drawing, without a map — cheap enough for every card in a feed. */
export default function TrackSketch({ points, label }: { points: Array<[number, number]>; label: string }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 80;
  const midLat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p[1] * kx);
  const ys = points.map((p) => -p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - 12) / (maxX - minX || 1e-9), (H - 12) / (maxY - minY || 1e-9));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const d = xs.map((x, i) => `${i ? "L" : "M"}${(ox + (x - minX) * scale).toFixed(1)},${(oy + (ys[i] - minY) * scale).toFixed(1)}`).join(" ");
  return (
    <svg className="track-sketch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path d={d} />
    </svg>
  );
}
