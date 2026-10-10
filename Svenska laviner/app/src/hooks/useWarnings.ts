import { useEffect, useState } from "react";
import { fetchWarnings, type WeatherWarning } from "../services/warningService";

/** An area's current SMHI warnings, or null while loading / when there are none. */
export function useWarnings(regionId: string): WeatherWarning[] | null {
  const [list, setList] = useState<WeatherWarning[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchWarnings()
      .then((all) => live && setList(all[regionId] ?? []))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [regionId]);
  return list;
}

