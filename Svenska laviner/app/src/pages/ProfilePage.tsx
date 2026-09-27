import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { fetchMyObservations } from "../services/observationService";
import { fetchMyTours } from "../services/tourService";
import TourCard from "../components/TourCard";
import type { Tour } from "../types/tour";
import type { Observation } from "../types/observation";

export default function ProfilePage() {
  const { user, token, loading, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Observation[] | null>(null);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    fetchMyObservations(token)
      .then(setMine)
      .catch((err: Error) => setError(err.message));
    fetchMyTours(token)
      .then(setTours)
      .catch(() => setTours([]));
  }, [token]);

  useEffect(load, [load]);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/logga-in?next=/profil" replace />;

  async function onDeleteAccount() {
    if (
      !window.confirm(
        "Radera ditt konto? Alla dina observationer, bilder och turer tas bort permanent. Det går inte att ångra."
      )
    )
      return;
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte radera kontot.");
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>{user.displayName}</h1>
        <p className="page__lead">{user.email}</p>
        <div className="button-row">
          <Link to="/observationer/ny" className="button button--primary">
            + Ny observation
          </Link>
          <Link to="/turer/ny" className="button">
            + Ny tur
          </Link>
          {user.isAdmin && (
            <Link to="/admin" className="button">
              Anmälda inlägg
            </Link>
          )}
          <button type="button" className="button" onClick={() => void logout()}>
            Logga ut
          </button>
        </div>
      </header>

      <VerifyEmailNotice />

      <section className="section">
        <h2>Mina observationer</h2>
        {error && <p className="error">{error}</p>}
        {!mine && !error && <PageLoading label="Laddar…" />}
        {mine && mine.length === 0 && <p className="section__intro">Du har inte delat några observationer än.</p>}
        <div className="observation-list">
          {mine?.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} />)}
        </div>
      </section>

      <section className="section">
        <h2>Mina turer</h2>
        {!tours && <PageLoading label="Laddar…" />}
        {tours && tours.length === 0 && (
          <p className="section__intro">
            Inga turer än. <Link to="/turer/ny">Lägg till en från klockan</Link>.
          </p>
        )}
        <div className="tour-list">{tours?.map((t) => <TourCard key={t.id} tour={t} />)}</div>
      </section>

      <section className="section">
        <h2>Konto</h2>
        <p className="section__intro">
          Raderar du kontot tas din e-post, ditt användarnamn och alla dina observationer, bilder och turer bort.
        </p>
        <button type="button" className="button button--danger" onClick={() => void onDeleteAccount()}>
          Radera mitt konto
        </button>
      </section>
    </div>
  );
}
