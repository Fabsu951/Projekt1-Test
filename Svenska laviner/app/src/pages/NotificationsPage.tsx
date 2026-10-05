import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Avatar from "../components/Avatar";
import PageLoading from "../components/PageLoading";
import { fetchNotifications, markAllRead, type AppNotification } from "../services/notificationService";
import { accountPushEnabled, disableAccountPush, enableAccountPush, fetchPushKey, pushSupported } from "../services/push";
import type { Badge } from "../types/social";

const when = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** New followers, comments, likes and replies — newest first. */
export default function NotificationsPage() {
  const { user, token, loading } = useAuth();
  const [list, setList] = useState<AppNotification[] | null>(null);
  const [people, setPeople] = useState<Record<number, Badge>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchNotifications(token)
      .then((r) => {
        if (cancelled) return;
        setList(r.notifications);
        setPeople(r.people);
        // Shown once as unread, then marked read.
        if (r.unread > 0) void markAllRead(token);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <PageLoading />;
  if (!user || !token) return <Navigate to="/logga-in?next=/notiser" replace />;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Notiser</h1>
        <p className="page__lead">När någon börjar följa dig, kommenterar, gillar eller svarar i en tråd du är med i.</p>
      </header>

      <AccountPushToggle token={token} />

      {error && <p className="error">{error}</p>}
      {!list && !error && <PageLoading label="Laddar…" />}
      {list && list.length === 0 && (
        <p className="section__intro">
          Inga notiser än. <Link to="/flode">Hitta kompisar att följa</Link>.
        </p>
      )}
      <ul className="notification-list">
        {list?.map((n) => (
          <li key={n.id} className={n.read ? "notification" : "notification notification--unread"}>
            <Link to={n.url} className="notification__link">
              <Avatar name={n.actor.displayName} avatarPath={people[n.actor.id]?.avatarPath} xp={people[n.actor.id]?.xp} size={40} />
              <span>
                <span className="notification__text">{n.text}</span>
                <span className="notification__time">{when(n.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Opt-in push to this browser for the account's notifications. */
function AccountPushToggle({ token }: { token: string }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    Promise.all([fetchPushKey(), accountPushEnabled(token)])
      .then(([key, enabled]) => {
        if (cancelled) return;
        setPublicKey(key);
        setOn(Boolean(key && enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!pushSupported() || !publicKey) return null;

  async function toggle(next: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      if (next) await enableAccountPush(publicKey!, token);
      else await disableAccountPush(token);
      setOn(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Det gick inte att ändra notiserna.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-push">
      <label className="form__field form__field--checkbox">
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
        Skicka notiserna till den här enheten även när Toppkoll är stängt
      </label>
      {message && <p className="error">{message}</p>}
    </div>
  );
}
