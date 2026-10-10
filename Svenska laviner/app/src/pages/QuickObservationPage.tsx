import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "../auth/useAuth";
import LocationPicker, { type Point } from "../components/LocationPicker";
import PageLoading from "../components/PageLoading";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { QUICK_CHOICES, quickObservation, toggleChoice, type QuickChoice } from "../data/quickObservation";
import { REGIONS } from "../data/regions";
import { submitObservation } from "../services/observationQueue";
import { nearestRegionId } from "../utils/geo";

type Fix = { kind: "locating" } | { kind: "found"; point: Point; accuracyM: number } | { kind: "failed" };

/** Worse than this, the map is shown so the spot can be corrected. */
const ROUGH_ACCURACY_M = 500;

/**
 * "Snabbobservation": what you saw with big buttons, position from the
 * phone, the time is now. Ten seconds with gloves on; the full form is one
 * link away for details, a photo or snow depth.
 */
export default function QuickObservationPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<QuickChoice[]>([]);
  const [note, setNote] = useState("");
  const [fix, setFix] = useState<Fix>({ kind: "locating" });
  const [picked, setPicked] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canPost = !!user?.canPost;

  useEffect(() => {
    if (!canPost) return;
    let live = true;
    Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 })
      .then((pos) => {
        if (!live) return;
        setFix({
          kind: "found",
          point: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracyM: Math.round(pos.coords.accuracy),
        });
      })
      .catch(() => live && setFix({ kind: "failed" }));
    return () => {
      live = false;
    };
  }, [canPost]);

  if (loading) return <PageLoading />;
  if (!user || !token) return <Navigate to="/logga-in?next=/observationer/snabb" replace />;
  if (!canPost) {
    return (
      <div className="page">
        <header className="page__header">
          <h1>Snabbobservation</h1>
        </header>
        <VerifyEmailNotice />
      </div>
    );
  }

  const rough = fix.kind === "failed" || (fix.kind === "found" && fix.accuracyM > ROUGH_ACCURACY_M);
  const point = picked ?? (fix.kind === "found" ? fix.point : null);
  const observation = quickObservation(chosen, note);

  async function send() {
    if (!observation || !point) return;
    setBusy(true);
    setError(null);
    try {
      await submitObservation(token!, user!.id, {
        type: observation.type,
        lat: point.lat,
        lon: point.lon,
        regionId: nearestRegionId(point, REGIONS),
        observedAt: new Date(),
        description: observation.description,
        image: null,
        dangerSigns: observation.dangerSigns,
        snowDepthCm: null,
      });
      navigate("/observationer", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka observationen.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Snabbobservation</h1>
        <p className="page__lead">Tryck på det du ser just nu. Plats och tid tas från telefonen.</p>
      </header>

      <div className="quick-obs__choices" role="group" aria-label="Vad ser du?">
        {QUICK_CHOICES.map((c) => {
          const on = chosen.includes(c.choice);
          return (
            <button
              key={c.choice}
              type="button"
              className={`quick-obs__choice${on ? " quick-obs__choice--on" : ""}${c.choice === "inga_tecken" ? " quick-obs__choice--none" : ""}`}
              aria-pressed={on}
              onClick={() => setChosen((list) => toggleChoice(list, c.choice))}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <label className="form__field quick-obs__note">
        Kort kommentar <span className="form__hint">(valfritt)</span>
        <input
          type="text"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="T.ex. nordostsluttning, 1100 m"
        />
      </label>

      <p className="quick-obs__position" role="status">
        {fix.kind === "locating" && "Hämtar din position…"}
        {fix.kind === "found" && !picked && `Position från telefonen (±${fix.accuracyM} m).`}
        {fix.kind === "failed" && !picked && "Kunde inte hämta din position. Tryck på kartan där du är."}
        {picked && "Platsen är vald på kartan."}
        {fix.kind === "found" && fix.accuracyM > ROUGH_ACCURACY_M && !picked && " Den är osäker, rätta gärna på kartan."}
      </p>
      {rough && <LocationPicker value={point} onChange={setPicked} />}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button--primary quick-obs__send"
        disabled={busy || !observation || !point}
        onClick={() => void send()}
      >
        {busy ? "Skickar…" : !observation ? "Välj vad du ser" : !point ? "Väntar på position…" : "Skicka observationen"}
      </button>
      <p className="muted quick-obs__more">
        Vill du lägga till bild, snödjup eller mer text? <Link to="/observationer/ny">Använd hela formuläret</Link>.
      </p>
    </div>
  );
}
