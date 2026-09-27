import { Link } from "react-router-dom";
import { getRegionById } from "../data/regions";
import type { Tour } from "../types/tour";
import { formatDistance, formatDuration, formatTourDate } from "../utils/tourFormat";

export default function TourCard({ tour }: { tour: Tour }) {
  const region = tour.regionId ? getRegionById(tour.regionId) : undefined;
  const duration = formatDuration(tour.durationS);
  return (
    <article className="tour-card">
      <header className="tour-card__header">
        <Link to={`/turer/${tour.id}`} className="tour-card__title">
          {tour.title}
        </Link>
        {!tour.shared && <span className="tour-card__private">Privat</span>}
      </header>
      <p className="tour-card__meta">
        {formatTourDate(tour.startedAt)}
        {region ? ` · ${region.name}` : ""} · {tour.author}
      </p>
      <ul className="tour-card__stats" aria-label="Turens fakta">
        <li>{formatDistance(tour.distanceM)}</li>
        <li>↑ {tour.ascentM} m</li>
        {duration && <li>{duration}</li>}
      </ul>
    </article>
  );
}
