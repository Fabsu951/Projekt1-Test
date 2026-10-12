import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import FollowButton from "../components/FollowButton";
import Avatar from "../components/Avatar";
import { fetchMyBlocks, fetchMyFollows, fetchPerson, removeAvatar, setBlocked, uploadAvatar } from "../services/socialService";
import LevelCard, { XpExplainer } from "../components/LevelCard";
import { prepareAvatar } from "../utils/image";
import type { Person, PersonSummary } from "../types/social";
import AdminBadge from "../components/AdminBadge";
import { t, locale } from "../i18n";

export default function ProfilePage() {
  const { user, token, loading, logout, deleteAccount, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Observation[] | null>(null);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [routes, setRoutes] = useState<PlannedRoute[] | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [follows, setFollows] = useState<{ following: PersonSummary[]; followers: PersonSummary[] } | null>(null);
  const [blocks, setBlocks] = useState<PersonSummary[]>([]);
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
    if (user) {
      fetchPerson(user.id, token)
        .then(setMe)
        .catch(() => setMe(null));
    }
    fetchMyFollows(token)
      .then(setFollows)
      .catch(() => setFollows({ following: [], followers: [] }));
    fetchMyBlocks(token)
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, [token, user]);

  useEffect(load, [load]);

  async function changeAvatar(file: File | undefined) {
    if (!file || !token || !me) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const avatarPath = await uploadAvatar(token, await prepareAvatar(file));
      setMe({ ...me, avatarPath });
      void refreshUser();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : t("Kunde inte spara bilden."));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function dropAvatar() {
    if (!token || !me) return;
    setAvatarBusy(true);
    try {
      await removeAvatar(token);
      setMe({ ...me, avatarPath: null });
      void refreshUser();
    } finally {
      setAvatarBusy(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/logga-in?next=/profil" replace />;

  async function onDeleteAccount() {
    if (
      !window.confirm(
        t("Radera ditt konto? Allt du har lagt upp – observationer, bilder, turer, rutter och kommentarer – tas bort permanent. Det går inte att ångra.")
      )
    )
      return;
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte radera kontot."));
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>
          {user.displayName}
          <AdminBadge show={user.isAdmin} />
        </h1>
        <p className="page__lead">{user.email}</p>
        <div className="button-row">
          <Link to="/observationer/ny" className="button button--primary">
            {t("+ Ny observation")}
          </Link>
          <Link to="/turer/ny" className="button">
            {t("+ Ny tur")}
          </Link>
          {user.isAdmin && (
            <Link to="/admin" className="button">
              {t("Anmälda inlägg")}
            </Link>
          )}
          {user.isAdmin && (
            <Link to="/admin/oversikt" className="button">
              {t("Översikt")}
            </Link>
          )}
          <button type="button" className="button" onClick={() => void logout()}>
            {t("Logga ut")}
          </button>
        </div>
      </header>

      <VerifyEmailNotice />

      {me && (
        <section className="section">
          <LevelCard
            person={me}
            actions={
              <div className="button-row">
                <label className={avatarBusy ? "button button--disabled" : "button"}>
                  {me.avatarPath ? t("Byt profilbild") : t("Lägg till profilbild")}
                  <input
                    type="file"
                    accept="image/*"
                    className="file-input--hidden"
                    disabled={avatarBusy}
                    onChange={(e) => void changeAvatar(e.target.files?.[0])}
                  />
                </label>
                {me.avatarPath && (
                  <button type="button" className="button" disabled={avatarBusy} onClick={() => void dropAvatar()}>
                    {t("Ta bort bild")}
                  </button>
                )}
              </div>
            }
          />
          {avatarError && <p className="error">{avatarError}</p>}
          <XpExplainer />
        </section>
      )}

      <CollapsibleSection id="profile-following" title={t("Följer")} count={follows?.following.length}>
        <PeopleList
          people={follows?.following ?? null}
          empty={
            <>
              {t("Du följer ingen än.")}{" "}<Link to="/flode">{t("Hitta kompisar i flödet")}</Link>.
            </>
          }
        />
      </CollapsibleSection>

      <CollapsibleSection id="profile-followers" title={t("Följare")} count={follows?.followers.length}>
        <PeopleList people={follows?.followers ?? null} empty={t("Ingen följer dig än.")} />
      </CollapsibleSection>

      {blocks.length > 0 && (
        <CollapsibleSection id="profile-blocked" title={t("Blockerade")} count={blocks.length}>
          <ul className="people-list">
            {blocks.map((p) => (
              <li key={p.id}>
                <span className="people-list__name">
                  <Avatar name={p.displayName} avatarPath={p.avatarPath} xp={p.xp} size={36} />
                  {p.displayName}
                </span>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    if (!token) return;
                    await setBlocked(token, p.id, false);
                    setBlocks((list) => list.filter((b) => b.id !== p.id));
                  }}
                >
                  {t("Sluta blockera")}
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <CollapsibleSection id="profile-observations" title={t("Mina observationer")} count={mine?.length}>
        {error && <p className="error">{error}</p>}
        {!mine && !error && <PageLoading label={t("Laddar…")} />}
        {mine && mine.length === 0 && <p className="section__intro">{t("Du har inte delat några observationer än.")}</p>}
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

      <CollapsibleSection id="profile-tours" title={t("Mina turer")} count={tours?.length}>
        {!tours && <PageLoading label={t("Laddar…")} />}
        {tours && tours.length === 0 && (
          <p className="section__intro">
            {t("Inga turer än.")}{" "}<Link to="/turer/ny">{t("Lägg till en från klockan")}</Link>.
          </p>
        )}
        {tours && (
          <ShowMore
            items={tours}
            render={(visible) => <div className="tour-list">{visible.map((tour) => <TourCard key={tour.id} tour={tour} />)}</div>}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection id="profile-routes" title={t("Mina rutter")} count={routes?.length}>
        {!routes && <PageLoading label={t("Laddar…")} />}
        {routes && routes.length === 0 && (
          <p className="section__intro">
            {t("Inga sparade rutter än.")}{" "}<Link to="/karta">{t("Planera en på kartan")}</Link>{" "}{t("och tryck \"Spara i mitt konto\".")}
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
                        {new Date(r.updatedAt).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" })}
                        {r.shared && t(" · delad via länk")}
                      </span>
                    </div>
                    <div className="route-card__actions">
                      <Link to={`/karta?rutt=${r.id}`} className="button">
                        {t("Öppna i kartan")}
                      </Link>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={async () => {
                          if (!token || !window.confirm(t("Ta bort rutten \"{title}\"?", { title: r.title }))) return;
                          await deleteRoute(token, r.id);
                          setRoutes((list) => list?.filter((x) => x.id !== r.id) ?? null);
                        }}
                      >
                        {t("Ta bort")}
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
        <h2>{t("Konto")}</h2>
        <p className="section__intro">
          {t("Raderar du kontot tas din e-post, ditt användarnamn, din profilbild och alla dina observationer, bilder, turer, rutter, kommentarer och följare bort.")}
        </p>
        <button type="button" className="button button--danger" onClick={() => void onDeleteAccount()}>
          {t("Radera mitt konto")}
        </button>
      </section>
    </div>
  );
}

function PeopleList({ people, empty }: { people: PersonSummary[] | null; empty: ReactNode }) {
  if (!people) return <PageLoading label={t("Laddar…")} />;
  if (people.length === 0) return <p className="section__intro">{empty}</p>;
  return (
    <ShowMore
      items={people}
      initial={10}
      render={(visible) => (
        <ul className="people-list">
          {visible.map((p) => (
            <li key={p.id}>
              <Link to={`/person/${p.id}`} className="people-list__name">
                <Avatar name={p.displayName} avatarPath={p.avatarPath} xp={p.xp} size={36} />
                {p.displayName}
                <AdminBadge show={p.isAdmin} />
              </Link>
              <FollowButton personId={p.id} following={p.iFollow} />
            </li>
          ))}
        </ul>
      )}
    />
  );
}
