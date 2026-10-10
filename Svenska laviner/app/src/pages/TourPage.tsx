import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import TrackMap from "../components/TrackMap";
import { getRegionById } from "../data/regions";
import { HIDE_ENDS_CHOICES } from "../data/tourSeasons";
import { tourVisibility, VISIBILITY_CHOICES } from "../data/tourVisibility";
import Reactions from "../components/Reactions";
import { usePageTitle } from "../components/pageTitle";
import type { TourVisibility } from "../types/tour";
import { deleteTour, fetchTour, updateTour } from "../services/tourService";
import type { TourWithTrack } from "../types/tour";
import { formatDistance, formatDuration, formatTourDate } from "../utils/tourFormat";
import AdminBadge from "../components/AdminBadge";
import ReportButton from "../components/ReportButton";
import ShareButton from "../components/ShareButton";
import { t } from "../i18n";
import Icon from "../components/Icon";

export default function TourPage() {
  const { id = "" } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TourWithTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  usePageTitle(data?.tour.title);

  useEffect(() => {
    let cancelled = false;
    fetchTour(Number(id), token)
      .then((d) => !cancelled && setData(d))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (error && !data) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <Link to="/turer"><Icon name="arrowLeft" size={16} className="icon--link" />{t("Alla turer")}</Link>
      </div>
    );
  }
  if (!data) return <PageLoading label={t("Laddar tur…")} />;

  const { tour, track } = data;
  const isOwner = user?.id === tour.userId;
  const region = tour.regionId ? getRegionById(tour.regionId) : undefined;
  const duration = formatDuration(tour.durationS);

  async function change(changes: Parameters<typeof updateTour>[2]) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateTour(token, tour.id, changes);
      setData((d) => (d ? { ...d, tour: updated } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte spara ändringen."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token || !window.confirm(t("Ta bort turen? Det går inte att ångra."))) return;
    try {
      await deleteTour(token, tour.id);
      navigate("/turer", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte ta bort turen."));
    }
  }

  return (
    <div className="page">
      <Link to="/turer" className="back-link">
        <Icon name="arrowLeft" size={16} className="icon--link" />{t("Alla turer")}
      </Link>
      <header className="page__header">
        <div className="page__title-row">
          <h1>{tour.title}</h1>
          {/* Only public tours: a followers-only link wouldn't open for others. */}
          {tourVisibility(tour) === "public" && (
            <ShareButton
              path={`/turer/${tour.id}`}
              title={tour.title}
              text={t("{title} – en tur på Snöläge", { title: tour.title })}
              label={t("Dela turen {title}", { title: tour.title })}
            />
          )}
        </div>
        <p className="page__lead">
          {formatTourDate(tour.startedAt)}
          {region ? (
            <>
              {" · "}
              <Link to={`/omrade/${region.id}`}>{region.name}</Link>
            </>
          ) : null}{" "}
          · <Link to={`/person/${tour.userId}`}>{tour.author}</Link>
          <AdminBadge show={tour.authorIsAdmin} />
        </p>
      </header>

      <ul className="tour-card__stats tour-page__stats" aria-label={t("Turens fakta")}>
        <li>{formatDistance(tour.distanceM)}</li>
        <li>↑ {tour.ascentM} m</li>
        <li>↓ {tour.descentM} m</li>
        {tour.maxElevationM !== null && <li>{t("Högst {m} m ö.h.", { m: tour.maxElevationM })}</li>}
        {duration && <li>{duration}</li>}
      </ul>

      {track.length > 1 ? (
        <TrackMap track={track} />
      ) : (
        <p className="notice">{t("Spåret är för kort för att visas när början och slutet döljs.")}</p>
      )}
      {!isOwner && tour.hideEndsM > 0 && (
        <p className="form__hint">{t("Början och slutet av spåret visas inte, av hänsyn till den som delat turen.")}</p>
      )}

      {tour.description && <p className="tour-page__description">{tour.description}</p>}

      {tourVisibility(tour) !== "private" && (
        <section className="section">
          <h2>{t("Kommentarer")}</h2>
          <Reactions type="tour" id={tour.id} open />
        </section>
      )}

      {isOwner && (
        <section className="section">
          <h2>{t("Dina inställningar")}</h2>
          <label className="form__field">
            {t("Vem ska se turen?")}
            <select
              value={tourVisibility(tour)}
              disabled={busy}
              onChange={(e) => void change({ visibility: e.target.value as TourVisibility })}
            >
              {VISIBILITY_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            {t("Dölj början och slutet för andra")}
            <select
              value={tour.hideEndsM}
              disabled={busy}
              onChange={(e) => void change({ hideEndsM: Number(e.target.value) })}
            >
              {HIDE_ENDS_CHOICES.map((c) => (
                <option key={c.meters} value={c.meters}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void remove()}>
              {t("Ta bort turen")}
            </button>
          </div>
        </section>
      )}
      {!isOwner && (
        <p className="report-row report-row--page">
          <ReportButton type="tour" id={tour.id} ownerId={tour.userId} label={t("Anmäl turen")} />
        </p>
      )}
      {user?.isAdmin && !isOwner && (
        <div className="button-row">
          <button type="button" className="button" onClick={() => void remove()}>
            {t("Ta bort (admin)")}
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
