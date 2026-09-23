import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import { fetchReported } from "../services/observationService";
import type { Observation } from "../types/observation";

export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !user?.isAdmin) return;
    fetchReported(token)
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [token, user]);

  useEffect(load, [load]);

  if (loading) return <PageLoading />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Anmälda inlägg</h1>
        <p className="page__lead">
          Inlägg döljs automatiskt efter 3 anmälningar. Återställ dem som är okej, ta bort resten.
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {!items && !error && <PageLoading label="Laddar…" />}
      {items && items.length === 0 && <p className="section__intro">Inga anmälda inlägg.</p>}
      <div className="observation-list">
        {items?.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} showAdminActions />)}
      </div>
    </div>
  );
}
