/**
 * Height curves around a summit, as on a topographic map: the backdrop
 * behind page headings. Purely decorative.
 */
export default function Contours({ className = "contours" }: { className?: string }) {
  const rings = [
    "M300 40c58 4 112 30 128 78 17 52-12 104-66 126-58 24-140 20-188-14-44-31-52-86-22-128 30-42 86-65 148-62Z",
    "M302 70c44 3 84 23 95 58 12 38-9 76-48 92-43 18-104 15-139-10-32-23-38-63-16-94 22-31 63-49 108-46Z",
    "M304 98c32 2 60 16 68 41 8 27-7 54-35 65-31 13-74 11-99-7-23-16-27-45-11-67 16-22 45-34 77-32Z",
    "M305 124c20 1 37 10 42 25 5 17-4 33-22 40-19 8-46 7-61-4-14-10-17-28-7-41 10-14 28-21 48-20Z",
    "M306 146c9 0 16 5 18 11 2 8-2 15-10 18-9 4-21 3-27-2-6-5-7-12-3-18 5-6 13-9 22-9Z",
    "M296 8c80 4 152 42 172 108 21 70-18 138-90 168-80 33-190 27-254-20-60-44-70-118-28-174 40-54 116-86 200-82Z",
  ];
  return (
    <svg className={className} viewBox="30 0 460 300" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--contour)" strokeWidth={i === 2 ? 2.2 : 1.3} />
      ))}
    </svg>
  );
}
