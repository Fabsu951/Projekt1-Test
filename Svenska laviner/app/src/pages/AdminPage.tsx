import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ContentReports from "../components/ContentReports";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import { fetchReported } from "../services/observationService";
import type { Observation } from "../types/observation";
import { t } from "../i18n";

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
        <h1>{t("Anmälda inlägg")}</h1>
        <p className="page__lead">
          {t("Observationer och kommentarer döljs automatiskt efter 3 anmälningar. Turer, rutter och profiler väntar på dig. Den som får något borttaget får en notis med skälet.")}
        </p>
      </header>
      <section className="section">
        <h2>{t("Turer, rutter, kommentarer och profiler")}</h2>
        {token && <ContentReports token={token} />}
      </section>
      <section className="section">
        <h2>{t("Observationer")}</h2>
        {error && <p className="error">{error}</p>}
        {!items && !error && <PageLoading label={t("Laddar…")} />}
        {items && items.length === 0 && <p className="section__intro">{t("Inga anmälda observationer.")}</p>}
        <div className="observation-list">
          {items?.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} showAdminActions />)}
        </div>
      </section>
    </div>
  );
}
