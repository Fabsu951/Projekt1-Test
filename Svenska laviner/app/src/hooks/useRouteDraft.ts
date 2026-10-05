import { useCallback, useState } from "react";
import type { PlannedRoute } from "../types/route";
import type { LatLon } from "../utils/routePlan";

const DRAFT_KEY = "fjallkoll:route-draft";

export interface RouteDraft {
  points: LatLon[];
  /** Id of the saved route this draft edits; null for a new, unsaved route. */
  id: number | null;
  title: string;
  shared: boolean;
  /** Points and name as last saved, to tell whether there are unsaved changes. */
  savedPoints: string | null;
  savedTitle: string | null;
}

const EMPTY: RouteDraft = { points: [], id: null, title: "", shared: false, savedPoints: null, savedTitle: null };

const isPoint = (p: unknown): p is LatLon =>
  Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));

/** The draft kept on the device; also reads the older plain list of points. */
function readDraft(): RouteDraft {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    if (Array.isArray(parsed)) return { ...EMPTY, points: parsed.filter(isPoint) };
    if (parsed && typeof parsed === "object") {
      const d = parsed as Partial<RouteDraft>;
      return {
        points: Array.isArray(d.points) ? d.points.filter(isPoint) : [],
        id: typeof d.id === "number" ? d.id : null,
        title: typeof d.title === "string" ? d.title : "",
        shared: d.shared === true,
        savedPoints: typeof d.savedPoints === "string" ? d.savedPoints : null,
        savedTitle: typeof d.savedTitle === "string" ? d.savedTitle : null,
      };
    }
  } catch {
    // Unreadable or blocked storage: start empty.
  }
  return EMPTY;
}

function writeDraft(draft: RouteDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Not remembered; the route still works until the page is closed.
  }
}

/** The route being planned, kept on the device so a reload doesn't lose it. */
export function useRouteDraft() {
  const [draft, setDraft] = useState<RouteDraft>(readDraft);

  const update = useCallback((change: (d: RouteDraft) => RouteDraft) => {
    setDraft((d) => {
      const next = change(d);
      writeDraft(next);
      return next;
    });
  }, []);

  const setPoints = useCallback((points: LatLon[]) => update((d) => ({ ...d, points })), [update]);
  const setTitle = useCallback((title: string) => update((d) => ({ ...d, title })), [update]);

  /** After saving: the draft now edits that saved route. */
  const markSaved = useCallback(
    (route: PlannedRoute) =>
      update(() => ({
        points: route.waypoints,
        id: route.id,
        title: route.title,
        shared: route.shared,
        savedPoints: JSON.stringify(route.waypoints),
        savedTitle: route.title,
      })),
    [update]
  );

  /** Opens a route: your own to edit, anyone else's as an unsaved copy. */
  const open = useCallback(
    (route: PlannedRoute) =>
      route.mine
        ? markSaved(route)
        : update(() => ({ ...EMPTY, points: route.waypoints, title: route.title })),
    [markSaved, update]
  );

  const startNew = useCallback(() => update(() => EMPTY), [update]);

  /** Opens a route kept on this device (works without coverage). */
  const openOffline = useCallback(
    (r: { routeId: number | null; title: string; waypoints: LatLon[] }) =>
      update(() => ({
        ...EMPTY,
        points: r.waypoints,
        id: r.routeId,
        title: r.title,
        savedPoints: r.routeId !== null ? JSON.stringify(r.waypoints) : null,
        savedTitle: r.routeId !== null ? r.title : null,
      })),
    [update]
  );

  const dirty =
    draft.id === null
      ? draft.points.length > 1
      : JSON.stringify(draft.points) !== draft.savedPoints || draft.title.trim() !== draft.savedTitle;

  return { draft, setPoints, setTitle, markSaved, open, openOffline, startNew, dirty };
}
