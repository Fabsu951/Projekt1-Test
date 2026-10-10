import { Link } from "react-router-dom";
import { useNearestRegion } from "../hooks/useNearestRegion";
import { t } from "../i18n";

export default function NearestRegion() {
  const { status, region, distanceKm, errorMessage, locate } = useNearestRegion();

  if (status === "idle") {
    return (
      <button type="button" className="nearest-region__button" onClick={locate}>
        {t("📍 Visa närmaste område")}
      </button>
    );
  }

  if (status === "loading") {
    return <p className="nearest-region__status">{t("Hämtar din position…")}</p>;
  }

  if (status === "denied") {
    return (
      <p className="nearest-region__status">
        {t("Platsåtkomst nekad. Du kan ändra det i enhetens inställningar för att se närmaste område.")}
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="nearest-region__status">
        {t("Kunde inte hämta din position")}{errorMessage ? `: ${errorMessage}` : ""}.
      </p>
    );
  }

  if (!region) return null;

  return (
    <Link to={`/omrade/${region.id}`} className="nearest-region__result">
      {t("📍 Närmast dig:")}{" "}<strong>{region.name}</strong>
      {distanceKm !== null && ` (~${Math.round(distanceKm)} km)`}
    </Link>
  );
}
