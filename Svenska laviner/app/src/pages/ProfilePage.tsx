import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ObservationCard from "../components/ObservationCard";
import PageLoading from "../components/PageLoading";
import VerifyEmailNotice from "../components/VerifyEmailNotice";
import { fetchMyObservations } from "../services/observationService";
import { fetchMyTours } from "../services/tourService";
import TourCard from "../components/TourCard";
import CollapsibleSection, { ShowMore } from "../components/CollapsibleSection";
import type { Tour } from "../types/tour";
import type { Observation } from "../types/observation";
import { deleteRoute, fetchMyRoutes } from "../services/routeService";
import type { PlannedRoute } from "../types/route";
import { formatDistance } from "../utils/tourFormat";

export default function ProfilePage() {
  const { user, token, loading, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Observation[] | null>(null);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [routes, setRoutes] = useState<PlannedRoute[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    fetchMyObservations(token)
      .then(setMine)
      .catch((err: Error) => setError(err.message));
    fetchMyTours(token)
      .then(setTours)
      .catch(() => setTours([]));
    fetchMyRoutes(token)
      .then(setRoutes)
      .catch(() => setRoutes([]));
  }, [token]);

  useEffect(load, [load]);

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/logga-in?next=/profil" replace />;

  async function onDeleteAccount() {
    if (
      !window.confirm(
        "Radera ditt konto? Alla dina observationer, bilder, turer och rutter tas bort permanent. Det går inte att ångra."
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

      <CollapsibleSection id="profile-observations" title="Mina observationer" count={mine?.length}>
        {error && <p className="error">{error}</p>}
        {!mine && !error && <PageLoading label="Laddar…" />}
        {mine && mine.length === 0 && <p className="section__intro">Du har inte delat några observationer än.</p>}
        {mine && (
          <ShowMore
            items={mine}
            render={(visible) => (
              <div className="observation-list">
                {visible.map((o) => <ObservationCard key={o.id} observation={o} onChanged={load} />)}
              </div>
            )}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection id="profile-tours" title="Mina turer" count={tours?.length}>
        {!tours && <PageLoading label="Laddar…" />}
        {tours && tours.length === 0 && (
          <p className="section__intro">
            Inga turer än. <Link to="/turer/ny">Lägg till en från klockan</Link>.
          </p>
        )}
        {tours && (
          <ShowMore
            items={tours}
            render={(visible) => <div className="tour-list">{visible.map((t) => <TourCard key={t.id} tour={t} />)}</div>}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection id="profile-routes" title="Mina rutter" count={routes?.length}>
        {!routes && <PageLoading label="Laddar…" />}
        {routes && routes.length === 0 && (
          <p className="section__intro">
            Inga sparade rutter än. <Link to="/karta">Planera en på kartan</Link> och tryck "Spara i mitt konto".
          </p>
        )}
        {routes && (
          <ShowMore
            items={routes}
            render={(visible) => (
              <ul className="route-list">
                {visible.map((r) => (
                  <li key={r.id} className="route-card">
                    <div>
                      <Link to={`/karta?rutt=${r.id}`} className="route-card__title">
                        {r.title}
                      </Link>
                      <span className="route-card__meta">
                        {formatDistance(r.distanceM)}
                        {r.ascentM !== null && ` · ↑ ${r.ascentM} m`} ·{" "}
                        {new Date(r.updatedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                        {r.shared && " · delad via länk"}
                      </span>
                    </div>
                    <div className="route-card__actions">
                      <Link to={`/karta?rutt=${r.id}`} className="button">
                        Öppna i kartan
                      </Link>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={async () => {
                          if (!token || !window.confirm(`Ta bort rutten "${r.title}"?`)) return;
                          await deleteRoute(token, r.id);
                          setRoutes((list) => list?.filter((x) => x.id !== r.id) ?? null);
                        }}
                      >
                        Ta bort
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        )}
      </CollapsibleSection>

      <section className="section">
        <h2>Konto</h2>
        <p className="section__intro">
          Raderar du kontot tas din e-post, ditt användarnamn och alla dina observationer, bilder, turer och rutter bort.
        </p>
        <button type="button" className="button button--danger" onClick={() => void onDeleteAccount()}>
          Radera mitt konto
        </button>
      </section>
    </div>
  );
}
