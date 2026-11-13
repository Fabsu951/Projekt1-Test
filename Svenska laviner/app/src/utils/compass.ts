// The direction the phone points, from the device's orientation sensors.
// iPhone (Safari and the app's web view) gives a ready compass heading
// (webkitCompassHeading) after the user allows motion access; Android
// (Chrome and its web view) gives an absolute alpha angle relative to north.
// Both are for the phone's top edge, so the screen's rotation is added.

interface OrientationLike {
  alpha: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
}

/** Degrees clockwise from north (0–360), or null when the event can't tell. */
export function headingFromEvent(event: OrientationLike, screenAngle: number, absoluteEvent: boolean): number | null {
  let heading: number | null = null;
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    heading = event.webkitCompassHeading;
  } else if ((absoluteEvent || event.absolute) && typeof event.alpha === "number") {
    // alpha grows counter-clockwise from north.
    heading = 360 - event.alpha;
  }
  if (heading === null) return null;
  return (((heading + screenAngle) % 360) + 360) % 360;
}

/** Eases a heading towards the next reading the short way round (no spin at north). */
export function smoothHeading(previous: number | null, next: number, weight = 0.3): number {
  if (previous === null) return next;
  const diff = ((next - previous + 540) % 360) - 180;
  return (((previous + diff * weight) % 360) + 360) % 360;
}

function screenAngle(): number {
  const angle = typeof screen !== "undefined" ? screen.orientation?.angle : undefined;
  if (typeof angle === "number") return angle;
  const legacy = (window as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * iPhones only send orientation after the user allows it, and the request
 * must come from a tap: call this inside the click handler that turns the
 * position on. Elsewhere it does nothing.
 */
export function requestCompassPermission(): void {
  const api = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as PermissionApi | undefined;
  if (api && typeof api.requestPermission === "function") {
    api.requestPermission().catch(() => {});
  }
}

/** Calls `onHeading` with each new heading; returns a function that stops listening. */
export function watchHeading(onHeading: (heading: number) => void): () => void {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return () => {};
  let gotAbsolute = false;
  const onAbsolute = (event: Event) => {
    const heading = headingFromEvent(event as unknown as OrientationLike, screenAngle(), true);
    if (heading === null) return;
    gotAbsolute = true;
    onHeading(heading);
  };
  const onPlain = (event: Event) => {
    // Android sends both events; the absolute one wins once it has arrived.
    if (gotAbsolute) return;
    const heading = headingFromEvent(event as unknown as OrientationLike, screenAngle(), false);
    if (heading !== null) onHeading(heading);
  };
  window.addEventListener("deviceorientationabsolute", onAbsolute);
  window.addEventListener("deviceorientation", onPlain);
  return () => {
    window.removeEventListener("deviceorientationabsolute", onAbsolute);
    window.removeEventListener("deviceorientation", onPlain);
  };
}
