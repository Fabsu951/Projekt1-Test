// Snöläge's own line icons, drawn on a 24 px grid with a 1.8 px stroke and
// slightly squared joins, so they read as one family next to the danger
// pictograms. Decorative by default; pass `label` when an icon stands alone.

const PATHS = {
  mountain: "M2.5 19.5 9 8l3.2 5.6L14.6 10l6.9 9.5Z M9 8l1.6 2.8-1.6-.9-1.5 1.3",
  map: "M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20Z M8.5 4v13.5 M15.5 6.5V20",
  pin: "M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z",
  bell: "M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15Z M10 20.5h4",
  star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z",
  arrowRight: "M4 12h15 M13.5 6.5 19 12l-5.5 5.5",
  arrowLeft: "M20 12H5 M10.5 6.5 5 12l5.5 5.5",
  arrowUpRight: "M7 17 17 7 M8.5 7H17v8.5",
  check: "m4.5 12.5 4.8 4.8L19.5 7",
  close: "M6 6l12 12 M18 6 6 18",
  plus: "M12 5v14 M5 12h14",
  share: "M12 3.5v11 M7.5 8 12 3.5 16.5 8 M5 12.5V20h14v-7.5",
  route: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M7.8 17H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7",
  layers: "M12 3.5 21 8.5l-9 5-9-5Z M3 12.5l9 5 9-5 M3 16.5l9 5 9-5",
  locate: "M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  expand: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  shrink: "M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5",
  calendar: "M4 6.5h16V20H4Z M4 10.5h16 M8.5 4v4 M15.5 4v4",
  snowflake: "M12 2.5v19 M3.8 7.2l16.4 9.6 M3.8 16.8l16.4-9.6 M9.5 4.5 12 7l2.5-2.5 M9.5 19.5 12 17l2.5 2.5",
  wind: "M3 9h11a3 3 0 1 0-3-3 M3 13h15a3 3 0 1 1-3 3 M3 17h7",
  alert: "M12 3.5 21.5 20h-19Z M12 10v4.5 M12 17.2v.3",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.5 M12 7.8v.3",
  cloudOff: "M7 18.5h10.5a3.5 3.5 0 0 0 .6-6.9A6 6 0 0 0 7.2 9.4 4.6 4.6 0 0 0 7 18.5Z M3.5 3.5l17 17",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20.5a7.5 7.5 0 0 1 15 0",
  book: "M4 5.5A2 2 0 0 1 6 3.5h13.5v14H6a2 2 0 0 0-2 2Z M4 19.5a2 2 0 0 0 2 2h13.5v-4",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4",
  moon: "M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z",
  hand: "M8 12V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6.5 6.5 0 0 1-5.6-3.2L3 15.3a1.5 1.5 0 0 1 2.6-1.5L8 16",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3Z",
  chevronDown: "m6 9.5 6 6 6-6",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6",
  camera: "M3 8h4l1.8-2.5h6.4L17 8h4v11.5H3Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  image: "M3.5 4.5h17v15h-17Z M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5.5 M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  search: "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M15.6 15.6 20.5 20.5",
  phone: "M5 3.5h3.5l1.8 4.6-2.3 1.6a12 12 0 0 0 6.3 6.3l1.6-2.3 4.6 1.8V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z",
  copy: "M8.5 8.5h11v12h-11Z M15.5 8.5v-5h-11v12h4",
  people: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.8a3.5 3.5 0 0 1 0 6.4 M18.5 14.5a6.5 6.5 0 0 1 3 5.5",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="miter"
      strokeMiterlimit={4}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
