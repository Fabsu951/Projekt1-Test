import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import FollowButton from "../components/FollowButton";
import LevelCard from "../components/LevelCard";
import { usePageTitle } from "../components/pageTitle";
import { removeAvatar } from "../services/socialService";
import PageLoading from "../components/PageLoading";
import TourCard from "../components/TourCard";
import { fetchPerson } from "../services/socialService";
import { fetchTours } from "../services/tourService";
import type { Person } from "../types/social";
import type { Tour } from "../types/tour";
import AdminBadge from "../components/AdminBadge";
import ReportButton from "../components/ReportButton";
import BlockButton from "../components/BlockButton";
import { t } from "../i18n";

/** Someone's public page: follow them and see the tours they share with you. */
export default function PersonPage() {
  const id = Number(useParams().id);
  const { user, token, loading } = useAuth();
  const [person, setPerson] = useState<Person | null>(null);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(person?.displayName);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    fetchPerson(id, token)
      .then((p) => !cancelled && setPerson(p))
      .catch((err: Error) => !cancelled && setError(err.message));
    fetchTours({ user: id, token, limit: 50 })
      .then((list) => !cancelled && setTours(list))
      .catch(() => !cancelled && setTours([]));
    return () => {
      cancelled = true;
    };
  }, [id, token, loading]);

  if (error) return <p className="page error">{error}</p>;
  if (!person) return <PageLoading />;

  return (
    <div className="page">
      <header className="page__header">
        <h1>
          {person.displayName}
          <AdminBadge show={person.isAdmin} />
        </h1>
        <LevelCard
          person={person}
          actions={
            <>
              <p className="page__lead">
                {t("{followers} följare · följer {following}", { followers: person.followers, following: person.following })}
                {person.followsMe && t(" · följer dig")}
              </p>
              <div className="button-row">
                {person.isMe ? (
                  <Link to="/profil" className="button">
                    {t("Till din profil")}
                  </Link>
                ) : (
                  !person.blocked && (
                    <FollowButton personId={person.id} following={person.iFollow} onChange={(p) => setPerson({ ...person, ...p })} />
                  )
                )}
                {!person.isMe && <ReportButton type="profile" id={person.id} ownerId={person.id} className="button" />}
                {!person.isMe && (!person.blocked || person.blockedByMe) && (
                  <BlockButton
                    personId={person.id}
                    name={person.displayName}
                    blocked={!!person.blockedByMe}
                    onChange={(blocked) => {
                      setPerson({ ...person, blocked, blockedByMe: blocked, iFollow: blocked ? false : person.iFollow });
                      if (blocked) setTours([]);
                    }}
                  />
                )}
                {user?.isAdmin && !person.isMe && person.avatarPath && token && (
                  <button
                    type="button"
                    className="button"
                    onClick={async () => {
                      if (!window.confirm(t("Ta bort profilbilden?"))) return;
                      await removeAvatar(token, person.id);
                      setPerson({ ...person, avatarPath: null });
                    }}
                  >
                    {t("Ta bort profilbild (admin)")}
                  </button>
                )}
              </div>
              {person.blockedByMe && (
                <p className="notice" role="status">
                  {t("Du har blockerat {name}. Ni ser inte varandras turer, observationer eller kommentarer.", { name: person.displayName })}
                </p>
              )}
            </>
          }
        />
      </header>

      <section className="section">
        <h2>{t("Turer")}</h2>
        {!tours && <PageLoading label={t("Laddar…")} />}
        {tours && tours.length === 0 && <p className="section__intro">{t("Inga turer som du kan se.")}</p>}
        <div className="tour-list">{tours?.map((tour) => <TourCard key={tour.id} tour={tour} />)}</div>
      </section>
    </div>
  );
}
