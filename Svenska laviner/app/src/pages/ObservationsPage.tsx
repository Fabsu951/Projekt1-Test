import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import { REGIONS } from "../data/regions";
import { fetchObservations } from "../services/observationService";
import type { Observation } from "../types/observation";

export default function ObservationsPage() {
  const { user } = useAuth();
  const [region, setRegion] = useState("");
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchObservations({ region: region || undefined, limit: 100 })
      .then((list) => {
        setError(null);
        setObservations(list);
      })
      .catch((err: Error) => setError(err.message));
  }, [region]);

  useEffect(load, [load]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Observationer</h1>
        <p className="page__lead">
          Lavinobservationer från andra åkare: laviner, sprickor, kollapser och annat värt att veta.
        </p>
        <div className="button-row">
          <Link to={user ? "/observationer/ny" : "/logga-in?next=/observationer/ny"} className="button button--primary">
            + Dela en observation
          </Link>
        </div>
      </header>

      <p className="notice">
        Observationerna delas av användare och granskas inte i förväg. De ersätter inte den officiella
        lavinprognosen eller din egen bedömning i fält.
      </p>

      <label className="form__field form__field--inline">
        Område
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Alla områden</option>
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}
      {!observations && !error && <PageLoading label="Laddar observationer…" />}
      {observations && observations.length === 0 && (
        <p className="section__intro">Inga observationer här än. Bli först att dela en!</p>
      )}
      <div className="observation-list">
        {observations?.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} />)}
      </div>
    </div>
  );
}
