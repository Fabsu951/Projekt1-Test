import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import FilePicker from "../components/FilePicker";
import { useAuth } from "../auth/useAuth";
import LocationPicker, { type Point } from "../components/LocationPicker";
import PageLoading from "../components/PageLoading";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { OBSERVATION_TYPES } from "../data/observationTypes";
import { DANGER_SIGNS } from "../data/dangerSigns";
import { REGIONS } from "../data/regions";
import { createObservation } from "../services/observationService";
import type { DangerSign, ObservationType } from "../types/observation";
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
  const [signs, setSigns] = useState<DangerSign[]>([]);
  const [snowDepth, setSnowDepth] = useState("");
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
    const depth = snowDepth.trim() === "" ? null : Number(snowDepth);
    if (depth !== null && (!Number.isInteger(depth) || depth < 0 || depth > 1000)) {
      return setError("Snödjupet ska vara ett heltal mellan 0 och 1000 cm.");
    }

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
        dangerSigns: signs,
        snowDepthCm: depth,
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

        <fieldset className="form__field">
          <legend>
            Varningstecken <span className="form__hint">(valfritt, kryssa i allt du såg)</span>
          </legend>
          <div className="sign-picker">
            {DANGER_SIGNS.map((s) => (
              <label key={s.sign} className="sign-picker__option">
                <input
                  type="checkbox"
                  checked={signs.includes(s.sign)}
                  onChange={(e) =>
                    setSigns((current) =>
                      e.target.checked ? [...current, s.sign] : current.filter((x) => x !== s.sign)
                    )
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="form__field">
          Snödjup <span className="form__hint">(valfritt, i cm)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            step={1}
            value={snowDepth}
            onChange={(e) => setSnowDepth(e.target.value)}
            className="form__input--short"
          />
        </label>

        <label className="form__field">
          Bild <span className="form__hint">(valfritt; platsdata i bilden tas bort)</span>
          <FilePicker accept="image/*" buttonLabel="Välj bild" onFile={(f) => void onImage(f)} />
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
