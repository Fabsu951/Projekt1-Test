import { useCallback, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { REGIONS } from "../data/regions";
import { haversineDistanceKm } from "../utils/geo";
import type { AvalancheRegion } from "../types/avalanche";

type Status = "idle" | "loading" | "success" | "denied" | "error";

interface NearestRegionState {
  status: Status;
  region: AvalancheRegion | null;
  distanceKm: number | null;
  errorMessage: string | null;
}

export function useNearestRegion() {
  const [state, setState] = useState<NearestRegionState>({
    status: "idle",
    region: null,
    distanceKm: null,
    errorMessage: null,
  });

  const locate = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", errorMessage: null }));

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
      });

      const here = { lat: position.coords.latitude, lon: position.coords.longitude };

      let nearest: AvalancheRegion | null = null;
      let nearestDistance = Infinity;
      for (const region of REGIONS) {
        const distance = haversineDistanceKm(here, region);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = region;
        }
      }

      setState({
        status: "success",
        region: nearest,
        distanceKm: nearestDistance,
        errorMessage: null,
      });
    } catch (err) {
      const geoError = err as Partial<GeolocationPositionError>;
      const message =
        geoError?.message ?? (err instanceof Error ? err.message : "Okänt platsfel");
      const denied = geoError?.code === 1 || /denied|permission/i.test(message);
      setState({
        status: denied ? "denied" : "error",
        region: null,
        distanceKm: null,
        errorMessage: message,
      });
    }
  }, []);

  return { ...state, locate };
}
