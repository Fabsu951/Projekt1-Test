import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { addComment, deleteComment, fetchComments, setLiked } from "../services/socialService";
import type { Badge, Comment, ItemType } from "../types/social";
import Avatar from "./Avatar";
import AdminBadge from "./AdminBadge";
import ReportButton from "./ReportButton";
import { t, locale, plural } from "../i18n";

const when = (iso: string) =>
  new Date(iso).toLocaleString(locale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Like button and comment thread under a tour, observation or route. The
 * thread loads when opened (or straight away with `open`).
 */
export default function Reactions({
  type,
  id,
  likes: initialLikes = 0,
  likedByMe: initialLiked = false,
  comments: initialCount = 0,
  open: startOpen = false,
}: {
  type: ItemType;
  id: number;
  likes?: number;
  likedByMe?: boolean;
  comments?: number;
  open?: boolean;
}) {
  const { user, token } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLikedState] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(startOpen);
  const [thread, setThread] = useState<Comment[] | null>(null);
  const [people, setPeople] = useState<Record<number, Badge>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchComments(type, id, token)
      .then((result) => {
        if (cancelled) return;
        setThread(result.comments);
        setPeople(result.people ?? {});
        setCount(result.comments.length);
        setLikes(result.likes);
        setLikedState(result.likedByMe);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [open, type, id, token]);

  async function toggleLike() {
    if (!token) return;
    const next = !liked;
    setLikedState(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const r = await setLiked(token, type, id, next);
      setLikes(r.likes);
      setLikedState(r.likedByMe);
    } catch {
      setLikedState(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await addComment(token, type, id, draft);
      setThread(comment.comments);
      setPeople(comment.people ?? {});
      setCount(comment.comments.length);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte skicka kommentaren."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Comment) {
    if (!token || !window.confirm(t("Ta bort kommentaren?"))) return;
    await deleteComment(token, c.id);
    setThread((list) => list?.filter((x) => x.id !== c.id) ?? null);
    setCount((n) => n - 1);
  }

  return (
    <div className="reactions">
      <div className="reactions__bar">
        {user ? (
          <button
            type="button"
            className={liked ? "reactions__like reactions__like--on" : "reactions__like"}
            aria-pressed={liked}
            onClick={() => void toggleLike()}
          >
            <span aria-hidden="true">{liked ? "♥" : "♡"}</span>{" "}{t("Gilla")}
            {likes > 0 && ` · ${likes}`}
          </button>
        ) : (
          likes > 0 && <span className="reactions__count">♥ {likes}</span>
        )}
        <button type="button" className="reactions__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {count === 0 ? t("Kommentera") : plural(count, "1 kommentar", "{n} kommentarer")}
        </button>
      </div>

      {open && (
        <div className="reactions__thread">
          {!thread && !error && <p className="reactions__hint">{t("Laddar…")}</p>}
          {thread?.map((c) => (
            <div key={c.id} className="comment">
              <Avatar name={c.author} avatarPath={people[c.userId]?.avatarPath} xp={people[c.userId]?.xp} size={30} />
              <div>
                <p className="comment__meta">
                  <Link to={`/person/${c.userId}`}>{c.author}</Link>
                  <AdminBadge show={people[c.userId]?.isAdmin} /> · {when(c.createdAt)}
                  {c.canDelete && (
                    <button type="button" className="comment__delete" onClick={() => void remove(c)}>
                      {t("Ta bort")}
                    </button>
                  )}
                  <ReportButton type="comment" id={c.id} ownerId={c.userId} className="comment__delete" />
                </p>
                <p className="comment__body">{c.body}</p>
              </div>
            </div>
          ))}
          {user ? (
            <form className="comment-form" onSubmit={(e) => void send(e)}>
              <textarea
                rows={2}
                maxLength={2000}
                value={draft}
                placeholder={t("Skriv en kommentar – fråga om förhållandena, tipsa om vägval…")}
                aria-label={t("Skriv en kommentar")}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="button" disabled={busy || !draft.trim()}>
                {t("Skicka")}
              </button>
            </form>
          ) : (
            <p className="reactions__hint">
              <Link to="/logga-in?next=/flode">{t("Logga in")}</Link>{" "}{t("för att kommentera.")}
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
