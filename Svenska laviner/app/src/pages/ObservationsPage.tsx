import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import { REGIONS } from "../data/regions";
import { OBSERVATION_TYPES } from "../data/observationTypes";
import { fetchObservations } from "../services/observationService";
import type { Observation } from "../types/observation";

export default function ObservationsPage() {
  const { user } = useAuth();
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [days, setDays] = useState(30);
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchObservations({ region: region || undefined, type: type || undefined, days: days || undefined, limit: 100 })
      .then((list) => {
        setError(null);
        setObservations(list);
      })
      .catch((err: Error) => setError(err.message));
  }, [region, type, days]);

  useEffect(load, [load]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Observationer</h1>
        <p className="page__lead">
          Lavinobservationer från andra åkare: laviner, sprickor, kollapser och annat värt att veta.
        </p>
        <div className="button-row">
          <Link to={user ? "/observationer/snabb" : "/logga-in?next=/observationer/snabb"} className="button button--primary">
            Snabbobservation
          </Link>
          <Link to={user ? "/observationer/ny" : "/logga-in?next=/observationer/ny"} className="button">
            + Utförlig observation
          </Link>
        </div>
      </header>

      <p className="notice">
        Observationerna delas av användare och granskas inte i förväg. De ersätter inte den officiella
        lavinprognosen eller din egen bedömning i fält.
      </p>

      <div className="filter-row">
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
        <label className="form__field form__field--inline">
          Typ
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Alla typer</option>
            {OBSERVATION_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field form__field--inline">
          Tid
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Senaste dygnet</option>
            <option value={3}>Senaste 3 dagarna</option>
            <option value={7}>Senaste veckan</option>
            <option value={30}>Senaste 30 dagarna</option>
            <option value={0}>Alla</option>
          </select>
        </label>
      </div>

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
