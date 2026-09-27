import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import TrackMap from "../components/TrackMap";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { HIDE_ENDS_CHOICES } from "../data/tourSeasons";
import { createTour } from "../services/tourService";
import { distanceM, importTrackFile, type TrackPoint } from "../utils/trackImport";
import { formatDistance } from "../utils/tourFormat";

export default function NewTourPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [shared, setShared] = useState(true);
  const [hideEndsM, setHideEndsM] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/logga-in?next=/turer/ny" replace />;
  if (!user.canPost) return <VerifyEmailNotice />;

  const hasTimes = points?.some((p) => p[3] !== null) ?? false;
  const length = points ? points.slice(1).reduce((sum, p, i) => sum + distanceM(points[i], p), 0) : 0;

  async function onFile(file: File | undefined) {
    setError(null);
    setPoints(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const imported = await importTrackFile(file);
      setPoints(imported);
      if (!title) setTitle(file.name.replace(/\.(gpx|fit)$/i, "").replace(/[_-]+/g, " ").trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa filen.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!points) return setError("Välj en GPX- eller FIT-fil först.");
    if (!hasTimes && !date) return setError("Spåret saknar tider – ange vilket datum turen gjordes.");
    setBusy(true);
    setError(null);
    try {
      const tour = await createTour(token!, {
        title: title.trim(),
        description: description.trim(),
        shared,
        hideEndsM,
        date: hasTimes ? null : date,
        points,
      });
      navigate(`/turer/${tour.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara turen.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Ny tur</h1>
        <p className="page__lead">
          Exportera turen som GPX eller FIT från klockan eller appen (Garmin Connect, Suunto, Coros, Strava …) och
          ladda upp filen här.
        </p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          Spårfil <span className="form__hint">(.gpx eller .fit)</span>
          <input type="file" accept=".gpx,.fit,application/gpx+xml" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>

        {points && (
          <>
            <p className="form__hint">
              {fileName}: {formatDistance(Math.round(length))}, {points.length.toLocaleString("sv-SE")} punkter.
            </p>
            <TrackMap track={points} />
          </>
        )}

        <label className="form__field">
          Titel
          <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {points && !hasTimes && (
          <label className="form__field">
            Datum <span className="form__hint">(spåret saknar tider)</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        <label className="form__field">
          Beskrivning{" "}
          <span className="form__hint">(förhållanden, vägval, var det var bra åkning, vad du undvek och varför)</span>
          <textarea rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="form__field form__field--checkbox">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          Dela turen med andra
        </label>

        {shared && (
          <label className="form__field">
            Dölj början och slutet <span className="form__hint">(så att ingen ser var du bor eller parkerar)</span>
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
        <button type="submit" className="button button--primary" disabled={busy || !points}>
          {busy ? "Sparar…" : "Spara tur"}
        </button>
      </form>
    </div>
  );
}
