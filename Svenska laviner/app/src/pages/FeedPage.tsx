import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import FeedCard from "../components/FeedCard";
import FollowButton from "../components/FollowButton";
import PageLoading from "../components/PageLoading";
import { fetchFeed, searchPeople } from "../services/socialService";
import type { FeedItem, PersonSummary } from "../types/social";

/** What the people you follow have shared, plus finding people to follow. */
export default function FeedPage() {
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchFeed(token)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextBefore(page.nextBefore);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!token || !nextBefore) return;
    setMore(true);
    try {
      const page = await fetchFeed(token, nextBefore);
      setItems((list) => [...(list ?? []), ...page.items]);
      setNextBefore(page.nextBefore);
    } finally {
      setMore(false);
    }
  }, [token, nextBefore]);

  if (loading) return <PageLoading />;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Flöde</h1>
        <p className="page__lead">
          Turer, observationer och rutter från dem du följer. Gilla, kommentera och fråga om förhållandena.
        </p>
      </header>

      {!user || !token ? (
        <p className="section__intro">
          <Link to="/logga-in?next=/flode">Logga in</Link> eller <Link to="/registrera">skapa ett konto</Link> för att
          följa andra åkare och se vad de delar.
        </p>
      ) : (
        <>
          <PeopleSearch token={token} />
          {error && <p className="error">{error}</p>}
          {!items && !error && <PageLoading label="Laddar flödet…" />}
          {items && items.length === 0 && (
            <p className="section__intro">
              Flödet är tomt än. Sök efter kompisar ovan och följ dem, eller{" "}
              <Link to="/turer/ny">lägg upp en tur</Link> själv.
            </p>
          )}
          <div className="feed">{items?.map((item) => <FeedCard key={`${item.type}-${item.id}`} item={item} />)}</div>
          {nextBefore && (
            <button type="button" className="button feed__more" disabled={more} onClick={() => void loadMore()}>
              {more ? "Laddar…" : "Visa äldre"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PeopleSearch({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PersonSummary[] | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPeople(token, query)
        .then((list) => !cancelled && setPeople(list))
        .catch(() => !cancelled && setPeople([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPeople(null);
    };
  }, [q, token]);

  return (
    <section className="people-search">
      <label className="form__field">
        Hitta kompisar
        <input type="search" value={q} placeholder="Sök på namn" onChange={(e) => setQ(e.target.value)} />
      </label>
      {q.trim().length >= 2 && people && (
        <ul className="people-list">
          {people.length === 0 && <li className="people-list__empty">Ingen hittades.</li>}
          {people.map((p) => (
            <li key={p.id}>
              <Link to={`/person/${p.id}`}>{p.displayName}</Link>
              <FollowButton personId={p.id} following={p.iFollow} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
