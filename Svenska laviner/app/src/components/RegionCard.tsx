import { Link } from "react-router-dom";
import type { AvalancheRegion, AvalancheForecast } from "../types/avalanche";
import DangerBadge from "./DangerBadge";

interface Props {
  region: AvalancheRegion;
  forecast?: AvalancheForecast;
}

export default function RegionCard({ region, forecast }: Props) {
  return (
    <Link to={`/omrade/${region.id}`} className="region-card">
      <div className="region-card__main">
        <h3>{region.name}</h3>
        <p className="region-card__sub">{region.subAreas.join(" · ")}</p>
      </div>
      {forecast ? (
        <DangerBadge level={forecast.dangerLevel} />
      ) : (
        <span className="region-card__loading">Laddar…</span>
      )}
    </Link>
  );
}
