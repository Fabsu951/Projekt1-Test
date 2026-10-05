import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import Reactions from "./Reactions";
import TrackSketch from "./TrackSketch";
import { getRegionById } from "../data/regions";
import { observationTypeLabel } from "../data/observationTypes";
import { imageUrl } from "../services/api";
import type { Badge, FeedItem } from "../types/social";
import { formatDistance, formatDuration, formatTourDate } from "../utils/tourFormat";
import AdminBadge from "./AdminBadge";

const ago = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One tour, observation or shared route in the feed, with likes and comments. */
export default function FeedCard({ item, badge }: { item: FeedItem; badge?: Badge }) {
  const author =
    item.type === "tour"
      ? { id: item.tour.userId, name: item.tour.author }
      : item.type === "observation"
        ? { id: item.observation.userId, name: item.observation.author }
        : { id: item.author.id, name: item.author.displayName };
  const what = item.type === "tour" ? "laddade upp en tur" : item.type === "observation" ? "delade en observation" : "delade en rutt";

  return (
    <article className={`feed-card feed-card--${item.type}`}>
      <div className="feed-card__who">
        <Link to={`/person/${author.id}`} aria-hidden="true" tabIndex={-1}>
          <Avatar name={author.name} avatarPath={badge?.avatarPath} xp={badge?.xp} size={40} />
        </Link>
        <p>
          <Link to={`/person/${author.id}`} className="feed-card__author">
            {author.name}
          </Link>
          <AdminBadge show={badge?.isAdmin} />{" "}
          {what} · <time dateTime={item.createdAt}>{ago(item.createdAt)}</time>
        </p>
      </div>

      {item.type === "tour" && <TourBody item={item} />}
      {item.type === "observation" && <ObservationBody item={item} />}
      {item.type === "route" && <RouteBody item={item} />}

      <Reactions type={item.type} id={item.id} likes={item.likes} likedByMe={item.likedByMe} comments={item.comments} />
    </article>
  );
}

function TourBody({ item }: { item: Extract<FeedItem, { type: "tour" }> }) {
  const t = item.tour;
  const region = t.regionId ? getRegionById(t.regionId) : undefined;
  const duration = formatDuration(t.durationS);
  return (
    <div className="feed-card__body">
      <div>
        <Link to={`/turer/${t.id}`} className="feed-card__title">
          {t.title}
        </Link>
        <p className="feed-card__meta">
          {formatTourDate(t.startedAt)}
          {region && ` · ${region.name}`}
          {t.visibility === "followers" && " · bara följare"}
        </p>
        <ul className="tour-card__stats" aria-label="Turens fakta">
          <li>{formatDistance(t.distanceM)}</li>
          <li>↑ {t.ascentM} m</li>
          {duration && <li>{duration}</li>}
        </ul>
        {t.description && <p className="feed-card__text">{t.description}</p>}
      </div>
      {item.line && <TrackSketch points={item.line} label={`Spåret för ${t.title}`} />}
    </div>
  );
}

function ObservationBody({ item }: { item: Extract<FeedItem, { type: "observation" }> }) {
  const o = item.observation;
  const region = o.regionId ? getRegionById(o.regionId) : undefined;
  return (
    <div className="feed-card__body">
      <div>
        <p className="feed-card__title">{observationTypeLabel(o.type)}</p>
        <p className="feed-card__meta">
          Observerad {ago(o.observedAt)}
          {region && ` · ${region.name}`}
        </p>
        <p className="feed-card__text">{o.description}</p>
      </div>
      {o.imagePath && <img className="feed-card__image" src={imageUrl(o.imagePath)} alt="Bild från observationen" loading="lazy" />}
    </div>
  );
}

function RouteBody({ item }: { item: Extract<FeedItem, { type: "route" }> }) {
  const r = item.route;
  return (
    <div className="feed-card__body">
      <div>
        <Link to={`/karta?rutt=${r.id}`} className="feed-card__title">
          {r.title}
        </Link>
        <ul className="tour-card__stats" aria-label="Ruttens fakta">
          <li>{formatDistance(r.distanceM)}</li>
          {r.ascentM !== null && <li>↑ {r.ascentM} m</li>}
        </ul>
        <Link to={`/karta?rutt=${r.id}`} className="feed-card__open">
          Öppna i kartan →
        </Link>
      </div>
      <TrackSketch points={r.waypoints} label={`Rutten ${r.title}`} />
    </div>
  );
}
