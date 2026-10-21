import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import QueuedObservationList from "../components/QueuedObservationList";
import { REGIONS } from "../data/regions";
import { OBSERVATION_TYPES } from "../data/observationTypes";
import { fetchObservations } from "../services/observationService";
import { QUEUE_CHANGED_EVENT } from "../services/observationQueue";
import type { Observation } from "../types/observation";
import { t } from "../i18n";

export default function ObservationsPage() {
  const { user } = useAuth();
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [days, setDays] = useState(30);
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only the latest request may fill the list: switching filters quickly
  // must not let a slower earlier answer show under the new filter.
  const latest = useRef(0);
  const load = useCallback(() => {
    const request = ++latest.current;
    fetchObservations({ region: region || undefined, type: type || undefined, days: days || undefined, limit: 100 })
      .then((list) => {
        if (request !== latest.current) return;
        setError(null);
        setObservations(list);
      })
      .catch((err: Error) => {
        if (request === latest.current) setError(err.message);
      });
  }, [region, type, days]);

  useEffect(load, [load]);

  // An observation that waited for coverage has just been sent: show it.
  useEffect(() => {
    const changed = (e: Event) => {
      if (((e as CustomEvent<{ sent?: number }>).detail?.sent ?? 0) > 0) load();
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, changed);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, changed);
  }, [load]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Observationer")}</h1>
        <p className="page__lead">
          {t("Lavinobservationer från andra åkare: laviner, sprickor, kollapser och annat värt att veta.")}
        </p>
        <div className="button-row">
          <Link to={user ? "/observationer/snabb" : "/logga-in?next=/observationer/snabb"} className="button button--primary">
            {t("Snabbobservation")}
          </Link>
          <Link to={user ? "/observationer/ny" : "/logga-in?next=/observationer/ny"} className="button">
            {t("+ Utförlig observation")}
          </Link>
        </div>
      </header>

      <QueuedObservationList />

      <p className="notice">
        {t("Observationerna delas av användare och granskas inte i förväg. De ersätter inte den officiella lavinprognosen eller din egen bedömning i fält.")}
      </p>

      <div className="filter-row">
        <label className="form__field form__field--inline">
          {t("Område")}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t("Alla områden")}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field form__field--inline">
          {t("Typ")}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t("Alla typer")}</option>
            {OBSERVATION_TYPES.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field form__field--inline">
          {t("Tid")}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>{t("Senaste dygnet")}</option>
            <option value={3}>{t("Senaste 3 dagarna")}</option>
            <option value={7}>{t("Senaste veckan")}</option>
            <option value={30}>{t("Senaste 30 dagarna")}</option>
            <option value={0}>{t("Alla")}</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {!observations && !error && <PageLoading label={t("Laddar observationer…")} />}
      {observations && observations.length === 0 && (
        <p className="section__intro">{t("Inga observationer här än. Bli först att dela en!")}</p>
      )}
      <div className="observation-list">
        {observations?.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} />)}
      </div>
    </div>
  );
}
