import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import LocationPicker, { type Point } from "../components/LocationPicker";
import PageLoading from "../components/PageLoading";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { OBSERVATION_TYPES } from "../data/observationTypes";
import { REGIONS } from "../data/regions";
import { createObservation } from "../services/observationService";
import type { ObservationType } from "../types/observation";
import { nearestRegionId } from "../utils/geo";
import { prepareImage } from "../utils/image";

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NewObservationPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<ObservationType | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [when, setWhen] = useState(() => localInputValue(new Date()));
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (loading) return <PageLoading />;
  if (!user || !token) return <Navigate to="/logga-in?next=/observationer/ny" replace />;
  if (!user.canPost) {
    return (
      <div className="page">
        <header className="page__header">
          <h1>Ny observation</h1>
        </header>
        <VerifyEmailNotice />
      </div>
    );
  }

  async function onImage(file: File | undefined) {
    setError(null);
    if (!file) {
      setImage(null);
      setPreview(null);
      return;
    }
    try {
      const blob = await prepareImage(file);
      setImage(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("Kunde inte läsa bilden. Prova en annan bild (JPEG eller PNG).");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!type) return setError("Välj typ av observation.");
    if (!point) return setError("Markera platsen på kartan.");
    const observedAt = new Date(when);
    if (Number.isNaN(observedAt.getTime())) return setError("Ange när du gjorde observationen.");

    setBusy(true);
    try {
      await createObservation(token!, {
        type,
        lat: point.lat,
        lon: point.lon,
        regionId: nearestRegionId(point, REGIONS),
        observedAt,
        description: description.trim(),
        image,
      });
      navigate("/observationer", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara observationen.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Ny observation</h1>
        <p className="page__lead">Dela vad du såg, så att andra åkare kan fatta bättre beslut.</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <fieldset className="form__field">
          <legend>Vad såg du?</legend>
          <div className="type-picker">
            {OBSERVATION_TYPES.map((t) => (
              <label key={t.type} className={type === t.type ? "type-picker__option type-picker__option--on" : "type-picker__option"}>
                <input type="radio" name="type" value={t.type} checked={type === t.type} onChange={() => setType(t.type)} />
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form__field">
          <span>Var?</span>
          <LocationPicker value={point} onChange={setPoint} />
        </div>

        <label className="form__field">
          När?
          <input type="datetime-local" required value={when} max={localInputValue(new Date())} onChange={(e) => setWhen(e.target.value)} />
        </label>

        <label className="form__field">
          Beskrivning <span className="form__hint">(höjd, väderstreck, storlek, lutning…)</span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="T.ex. Skjutsprickor ca 10 m långa på nordostvänd sluttning, 1100 m ö.h., ca 35°."
          />
        </label>

        <label className="form__field">
          Bild <span className="form__hint">(valfritt; platsdata i bilden tas bort)</span>
          <input type="file" accept="image/*" onChange={(e) => void onImage(e.target.files?.[0])} />
        </label>
        {preview && <img className="form__preview" src={preview} alt="Förhandsvisning av bilden" />}

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Publicerar…" : "Publicera observation"}
        </button>
      </form>
    </div>
  );
}
