import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "../auth/useAuth";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import {
  activeShare,
  DEFAULT_SHARE_HOURS,
  fetchMyShare,
  fetchSharedWithMe,
  sendPosition,
  SHARE_CHANGED_EVENT,
  SHARE_HOURS,
  SHARE_SENT_EVENT,
  startSharing,
  stopSharing,
  type FriendShare,
  type MyShare,
  type ShareCandidate,
  type SharedPosition,
} from "../services/locationShare";
import { clockTime, sinceText } from "../utils/shareTime";
import { t, plural } from "../i18n";

/** Asks for the position once, which also brings up the permission question. */
async function currentFix(): Promise<{ lat: number; lon: number; accuracy: number }> {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

function names(people: Array<{ displayName: string }>): string {
  const list = people.map((p) => p.displayName);
  if (list.length <= 1) return list.join("");
  return t("{first} och {last}", { first: list.slice(0, -1).join(", "), last: list[list.length - 1] });
}

/** "Dela position": who sees where you are, for how long – and who shares with you. */
export default function SharePositionPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [share, setShare] = useState<MyShare | null>(null);
  const [candidates, setCandidates] = useState<ShareCandidate[] | null>(null);
  const [friends, setFriends] = useState<FriendShare[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [hours, setHours] = useState<number>(DEFAULT_SHARE_HOURS);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<SharedPosition | null>(null);
  const [now, setNow] = useState(() => new Date());
  const userId = user?.id;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [mine, shared] = await Promise.all([fetchMyShare(token), fetchSharedWithMe(token).catch(() => [])]);
      // The server is the truth: forget a share here that ended elsewhere.
      if (!mine.share && (await activeShare(userId))) await stopSharing(null);
      setShare(mine.share);
      setLastSent(mine.share?.position ?? null);
      setCandidates(mine.candidates);
      setFriends(shared);
      setPicked(new Set(mine.share ? mine.share.viewers.map((v) => v.id) : mine.candidates.filter((c) => c.companion).map((c) => c.id)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att hämta delningen."));
    }
  }, [token, userId]);

  useEffect(() => {
    // After the first paint; the answer fills the page in.
    const first = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(first);
  }, [load]);

  useEffect(() => {
    const sent = (e: Event) => setLastSent((e as CustomEvent<SharedPosition>).detail);
    const changed = () => void load();
    window.addEventListener(SHARE_SENT_EVENT, sent);
    window.addEventListener(SHARE_CHANGED_EVENT, changed);
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.removeEventListener(SHARE_SENT_EVENT, sent);
      window.removeEventListener(SHARE_CHANGED_EVENT, changed);
      window.clearInterval(tick);
    };
  }, [load]);

  async function start() {
    if (!token || !user) return;
    setBusy(true);
    setError(null);
    let fix: { lat: number; lon: number; accuracy: number };
    try {
      fix = await currentFix();
    } catch {
      setError(t("Snöläge får inte använda din position. Tillåt platstjänster för Snöläge i telefonens inställningar och försök igen."));
      setBusy(false);
      return;
    }
    try {
      const started = await startSharing(token, user.id, [...picked], hours);
      try {
        await sendPosition(token, { lat: fix.lat, lon: fix.lon, accuracy: Math.round(fix.accuracy) });
      } catch {
        // The bridge sends again with the next fix.
      }
      setShare(started);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att börja dela."));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      await stopSharing(token);
      setShare(null);
      setLastSent(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att stoppa delningen."));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const companions = candidates?.filter((c) => c.companion) ?? [];
  const followed = candidates?.filter((c) => !c.companion) ?? [];
  const showForm = !share || editing;

  return (
    <div className="page share-page">
      <header className="page__header">
        <h1>{t("Dela position")}</h1>
        <p className="page__lead">{t("Låt turkompisarna se var du senast var, i några timmar. Bara de du väljer ser den, och den raderas när delningen tar slut.")}</p>
      </header>

      <div className="notice share-page__warning">
        <Icon name="alert" size={20} />
        <p>
          {t("Ersätter inte sändare/mottagare, spade och sond. Positionen skickas bara när Snöläge är öppen och telefonen har täckning – under snön har den det oftast inte.")}{" "}
          <strong>{t("Vid en olycka: ring 112.")}</strong>
        </p>
      </div>

      {authLoading ? null : !user || !token ? (
        <p>
          <Link to="/logga-in">{t("Logga in")}</Link> {t("för att dela din position med dem du åker med.")}
        </p>
      ) : (
        <>
          {share && !editing && (
            <section className="share-status" aria-labelledby="share-status-title">
              <h2 id="share-status-title" className="share-status__title">
                <span className="share-banner__dot" aria-hidden="true" />
                {t("Du delar din position till kl. {time}", { time: clockTime(share.endsAt) })}
              </h2>
              <p>{t("Ser den: {names}.", { names: names(share.viewers) })}</p>
              <p className="muted">
                {lastSent
                  ? t("Senast skickad {when}, ungefär ±{m} m.", { when: sinceText(lastSent.at, now), m: Math.round(lastSent.accuracy ?? 0) })
                  : t("Väntar på din position…")}
              </p>
              <div className="button-row">
                <button type="button" className="button button--danger" disabled={busy} onClick={() => void stop()}>
                  {t("Stoppa delningen")}
                </button>
                <button type="button" className="button" disabled={busy} onClick={() => setEditing(true)}>
                  {t("Ändra")}
                </button>
              </div>
            </section>
          )}

          {showForm && candidates !== null && (
            <section className="share-form" aria-labelledby="share-form-title">
              <h2 id="share-form-title">{share ? t("Ändra delningen") : t("Vem får se var du är?")}</h2>
              {candidates.length === 0 ? (
                <p className="muted">
                  {t("Du kan dela med dem du följer och dem du har en turdag med i dag.")} <Link to="/flode">{t("Hitta kompisar i flödet")}</Link>
                </p>
              ) : (
                <>
                  {[
                    [t("Med på dagens tur"), companions],
                    [t("Du följer"), followed],
                  ].map(([label, list]) =>
                    (list as ShareCandidate[]).length === 0 ? null : (
                      <fieldset key={label as string} className="share-people">
                        <legend>{label as string}</legend>
                        <ul className="share-people__list">
                          {(list as ShareCandidate[]).map((p) => (
                            <li key={p.id}>
                              <label className="share-people__row">
                                <input type="checkbox" checked={picked.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                                <span aria-hidden="true">
                                  <Avatar name={p.displayName} avatarPath={p.avatarPath} xp={p.xp} size={32} />
                                </span>
                                <span className="share-people__name">{p.displayName}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    )
                  )}
                  <fieldset className="share-hours">
                    <legend>{t("Hur länge?")}</legend>
                    <div className="chip-row" role="radiogroup" aria-label={t("Hur länge?")}>
                      {SHARE_HOURS.map((h) => (
                        <label key={h} className={hours === h ? "chip chip--on" : "chip"}>
                          <input type="radio" name="share-hours" checked={hours === h} onChange={() => setHours(h)} />
                          {plural(h, "{n} timme", "{n} timmar")}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="button-row">
                    <button type="button" className="button button--primary" disabled={busy || picked.size === 0} onClick={() => void start()}>
                      {share ? t("Spara ändringen") : t("Börja dela")}
                    </button>
                    {share && (
                      <button type="button" className="button" disabled={busy} onClick={() => setEditing(false)}>
                        {t("Avbryt")}
                      </button>
                    )}
                  </div>
                  <p className="muted">
                    {t("De du väljer får en notis och ser dig på kartan. Telefonen behöver ha Snöläge öppen för att skicka nya positioner.")}
                  </p>
                </>
              )}
            </section>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <section className="share-friends" aria-labelledby="share-friends-title">
            <h2 id="share-friends-title">{t("Delar med dig")}</h2>
            {friends.length === 0 ? (
              <p className="muted">{t("Ingen delar sin position med dig just nu.")}</p>
            ) : (
              <>
                <ul className="share-friends__list">
                  {friends.map((f) => (
                    <li key={f.id} className="share-friends__row">
                      <span aria-hidden="true">
                        <Avatar name={f.displayName} avatarPath={f.avatarPath} xp={f.xp} size={36} />
                      </span>
                      <div>
                        <Link to={`/person/${f.id}`} className="share-friends__name">
                          {f.displayName}
                        </Link>
                        <p className="muted">
                          {f.position
                            ? t("Position {when}, delar till kl. {time}", { when: sinceText(f.position.at, now), time: clockTime(f.endsAt) })
                            : t("Ingen position än, delar till kl. {time}", { time: clockTime(f.endsAt) })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link to="/karta?kompisar=1" className="button">
                  <Icon name="map" size={18} />
                  {t("Visa på kartan")}
                </Link>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
