import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import FilePicker from "../components/FilePicker";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import TrackMap from "../components/TrackMap";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { HIDE_ENDS_CHOICES } from "../data/tourSeasons";
import { VISIBILITY_CHOICES } from "../data/tourVisibility";
import type { TourVisibility } from "../types/tour";
import { createTour, SimilarTourError, type SimilarTour } from "../services/tourService";
import { distanceM, importTrackFile, type TrackPoint } from "../utils/trackImport";
import { formatDistance } from "../utils/tourFormat";
import { t, locale } from "../i18n";
import { TourSignsPicker } from "../components/TourSigns";
import type { TourSigns } from "../data/tourSigns";

export default function NewTourPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [visibility, setVisibility] = useState<TourVisibility>("public");
  const [hideEndsM, setHideEndsM] = useState(500);
  const [signs, setSigns] = useState<TourSigns>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** One of your tours that looks like the same outing; saving again needs a yes. */
  const [similar, setSimilar] = useState<SimilarTour | null>(null);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/logga-in?next=/turer/ny" replace />;
  if (!user.canPost) return <VerifyEmailNotice />;

  const hasTimes = points?.some((p) => p[3] !== null) ?? false;
  const length = points ? points.slice(1).reduce((sum, p, i) => sum + distanceM(points[i], p), 0) : 0;

  async function onFile(file: File | undefined) {
    setError(null);
    setSimilar(null);
    setPoints(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const imported = await importTrackFile(file);
      setPoints(imported);
      if (!title) setTitle(file.name.replace(/\.(gpx|fit)$/i, "").replace(/[_-]+/g, " ").trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte läsa filen."));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save(false);
  }

  async function save(allowDuplicate: boolean) {
    if (!points) return setError(t("Välj en GPX- eller FIT-fil först."));
    if (!hasTimes && !date) return setError(t("Spåret saknar tider – ange vilket datum turen gjordes."));
    setBusy(true);
    setError(null);
    setSimilar(null);
    try {
      const tour = await createTour(token!, {
        allowDuplicate,
        title: title.trim(),
        description: description.trim(),
        visibility,
        hideEndsM,
        dangerSigns: signs,
        date: hasTimes ? null : date,
        points,
      });
      navigate(`/turer/${tour.id}`, { replace: true });
    } catch (err) {
      if (err instanceof SimilarTourError) setSimilar(err.similarTo);
      else setError(err instanceof Error ? err.message : t("Kunde inte spara turen."));
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Ny tur")}</h1>
        <p className="page__lead">
          {t("Exportera turen som GPX eller FIT från klockan eller appen (Garmin Connect, Suunto, Coros, Strava …) och ladda upp filen här.")}
        </p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          {t("Spårfil")}{" "}<span className="form__hint">{t("(.gpx eller .fit)")}</span>
          <FilePicker accept=".gpx,.fit,application/gpx+xml" buttonLabel={t("Välj spårfil")} onFile={(f) => void onFile(f)} />
        </label>

        {points && (
          <>
            <p className="form__hint">
              {fileName}: {formatDistance(Math.round(length))}, {points.length.toLocaleString(locale())}{" "}{t("punkter.")}
            </p>
            <TrackMap track={points} />
          </>
        )}

        <label className="form__field">
          {t("Titel")}
          <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {points && !hasTimes && (
          <label className="form__field">
            {t("Datum")}{" "}<span className="form__hint">{t("(spåret saknar tider)")}</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        <label className="form__field">
          {t("Beskrivning")}{" "}
          <span className="form__hint">{t("(förhållanden, vägval, var det var bra åkning, vad du undvek och varför)")}</span>
          <textarea rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <TourSignsPicker value={signs} onChange={setSigns} />

        <label className="form__field">
          {t("Vem ska se turen?")}
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as TourVisibility)}>
            {VISIBILITY_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {visibility !== "private" && (
          <label className="form__field">
            {t("Dölj början och slutet")}{" "}<span className="form__hint">{t("(så att ingen ser var du bor eller parkerar)")}</span>
            <select value={hideEndsM} onChange={(e) => setHideEndsM(Number(e.target.value))}>
              {HIDE_ENDS_CHOICES.map((c) => (
                <option key={c.meters} value={c.meters}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {similar && (
          <div className="notice similar-tour" role="alert">
            <p>
              {t("Du har redan en tur som startade samtidigt och är ungefär lika lång:")}{" "}
              <Link to={`/turer/${similar.id}`}>{similar.title}</Link>
              {t(". Är det samma tur behöver du inte spara den igen.")}
            </p>
            <div className="button-row">
              <Link to={`/turer/${similar.id}`} className="button">
                {t("Visa den befintliga")}
              </Link>
              <button type="button" className="button" disabled={busy} onClick={() => void save(true)}>
                {t("Spara ändå")}
              </button>
            </div>
          </div>
        )}
        <button type="submit" className="button button--primary" disabled={busy || !points}>
          {busy ? t("Sparar…") : t("Spara tur")}
        </button>
      </form>
    </div>
  );
}
