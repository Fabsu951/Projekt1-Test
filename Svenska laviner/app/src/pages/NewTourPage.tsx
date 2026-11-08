import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
import { ApiError } from "../services/api";
import { discardRecording, readRecording, recordingStatus } from "../services/tourRecorder";
import { parseLines, recordingToTrack } from "../utils/recording";
import { withGroundElevation } from "../utils/groundElevation";
import { formatDistance } from "../utils/tourFormat";
import { t, locale } from "../i18n";
import { TourSignsPicker } from "../components/TourSigns";
import type { TourSigns } from "../data/tourSigns";

export default function NewTourPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /** Saving a tour recorded in the app ("Spela in tur") instead of a file. */
  const fromRecording = params.get("inspelning") === "1";
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!fromRecording) return;
    let live = true;
    void (async () => {
      const status = await recordingStatus();
      if (!live) return;
      if (status.state !== "finished") {
        setError(t("Det finns ingen avslutad inspelning att spara."));
        return;
      }
      const { lines } = await readRecording(0);
      const track = recordingToTrack(parseLines(lines));
      if (!live) return;
      if (track.length < 2) {
        setError(t("Inspelningen har för få GPS-punkter för att bli en tur."));
        return;
      }
      setPoints(track);
      const day = new Date(track[0][3] ?? status.startedAt);
      setTitle((old) => old || t("Tur {date}", { date: day.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }) }));
    })().catch(() => live && setError(t("Kunde inte läsa inspelningen.")));
    return () => {
      live = false;
    };
  }, [fromRecording]);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to={`/logga-in?next=${encodeURIComponent(fromRecording ? "/turer/ny?inspelning=1" : "/turer/ny")}`} replace />;
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
    if (!points) return setError(fromRecording ? t("Inspelningen har för få GPS-punkter för att bli en tur.") : t("Välj en GPX- eller FIT-fil först."));
    if (!hasTimes && !date) return setError(t("Spåret saknar tider – ange vilket datum turen gjordes."));
    setBusy(true);
    setError(null);
    setSimilar(null);
    try {
      // A phone's GPS heights add false climbing; use the height model when it loads.
      const track = fromRecording ? await withGroundElevation(points) : points;
      const tour = await createTour(token!, {
        allowDuplicate,
        title: title.trim(),
        description: description.trim(),
        visibility,
        hideEndsM,
        dangerSigns: signs,
        date: hasTimes ? null : date,
        points: track,
      });
      if (fromRecording) await discardRecording();
      navigate(`/turer/${tour.id}`, { replace: true });
    } catch (err) {
      if (err instanceof SimilarTourError) setSimilar(err.similarTo);
      else if (fromRecording && err instanceof ApiError && err.status === 0)
        setError(t("Ingen täckning just nu. Turen ligger kvar i telefonen – spara den när du har täckning."));
      else setError(err instanceof Error ? err.message : t("Kunde inte spara turen."));
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>{fromRecording ? t("Spara turen") : t("Ny tur")}</h1>
        <p className="page__lead">
          {fromRecording
            ? t("Ge turen ett namn och välj vem som får se den. Höjderna tas från höjdmodellen när den går att hämta, eftersom telefonens GPS-höjder är ungefärliga.")
            : t("Exportera turen som GPX eller FIT från klockan eller appen (Garmin Connect, Suunto, Coros, Strava …) och ladda upp filen här.")}
        </p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        {!fromRecording && (
          <label className="form__field">
            {t("Spårfil")}{" "}<span className="form__hint">{t("(.gpx eller .fit)")}</span>
            <FilePicker accept=".gpx,.fit,application/gpx+xml" buttonLabel={t("Välj spårfil")} onFile={(f) => void onFile(f)} />
          </label>
        )}

        {points && (
          <>
            <p className="form__hint">
              {fromRecording ? t("Inspelad med Snöläge") : fileName}: {formatDistance(Math.round(length))}, {points.length.toLocaleString(locale())}{" "}{t("punkter.")}
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
        {fromRecording && (
          <div className="recording__discard">
            {confirmDiscard ? (
              <>
                <p>{t("Vill du slänga inspelningen? Den går inte att få tillbaka.")}</p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    disabled={busy}
                    onClick={() => void discardRecording().then(() => navigate("/turer", { replace: true }))}
                  >
                    {t("Ja, släng den")}
                  </button>
                  <button type="button" className="button" onClick={() => setConfirmDiscard(false)}>
                    {t("Behåll den")}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="link-button link-button--danger" onClick={() => setConfirmDiscard(true)}>
                {t("Släng inspelningen")}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
