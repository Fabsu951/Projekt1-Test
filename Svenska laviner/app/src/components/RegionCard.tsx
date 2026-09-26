import { Link } from "react-router-dom";
import type { AvalancheRegion, AvalancheForecast } from "../types/avalanche";
import ForecastBadge from "./ForecastBadge";
import FavoriteButton from "./FavoriteButton";

interface Props {
  region: AvalancheRegion;
  forecast?: AvalancheForecast;
}

export default function RegionCard({ region, forecast }: Props) {
  return (
    <div className="region-card">
      <Link to={`/omrade/${region.id}`} className="region-card__link">
        <div className="region-card__main">
          <h3>{region.name}</h3>
          <p className="region-card__sub">{region.subAreas.join(" · ")}</p>
        </div>
        {forecast ? (
          <ForecastBadge forecast={forecast} />
        ) : (
          <span className="skeleton skeleton--badge" aria-label="Laddar farograd" />
        )}
      </Link>
      <FavoriteButton regionId={region.id} regionName={region.name} />
    </div>
  );
}
