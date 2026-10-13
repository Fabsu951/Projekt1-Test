import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  dismissContentReports,
  fetchContentReports,
  removeReportedContent,
  type ReportedItem,
  type ReportType,
} from "../services/reportService";
import { t, plural } from "../i18n";

const TYPE_LABEL: Record<ReportType, string> = {
  tour: t("Tur"),
  route: t("Rutt"),
  comment: t("Kommentar"),
  profile: t("Profil"),
};

const REMOVE_LABEL: Record<ReportType, string> = {
  tour: t("Ta bort turen"),
  route: t("Ta bort rutten"),
  comment: t("Ta bort kommentaren"),
  profile: t("Återställ namn och bild"),
};

/** Admin: reported tours, routes, comments and profiles, with dismiss / remove-with-reason. */
export default function ContentReports({ token }: { token: string }) {
  const [items, setItems] = useState<ReportedItem[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchContentReports(token)
      .then((r) => {
        setItems(r.items);
        setReasons(r.reasons);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(load, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!items) return <p className="section__intro">{t("Laddar…")}</p>;
  if (items.length === 0) return <p className="section__intro">{t("Inga anmälda turer, rutter, kommentarer eller profiler.")}</p>;
  return (
    <div className="content-reports">
      {items.map((item) => (
        <ReportedCard key={`${item.type}:${item.id}`} item={item} reasons={reasons} token={token} onDone={load} />
      ))}
    </div>
  );
}

function ReportedCard({
  item,
  reasons,
  token,
  onDone,
}: {
  item: ReportedItem;
  reasons: Record<string, string>;
  token: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Något gick fel."));
      setBusy(false);
    }
  }

  return (
    <article className="content-report">
      <header className="content-report__header">
        <span className="content-report__type">{TYPE_LABEL[item.type]}</span>
        <span className="content-report__count">
          {plural(item.reports, "1 anmälan", "{n} anmälningar")}
          {item.hidden && t(", dold")}
        </span>
      </header>
      <p className="content-report__summary">{item.summary}</p>
      <p className="content-report__meta">
        {t("av")}{" "}<Link to={`/person/${item.owner.id}`}>{item.owner.displayName}</Link>,{" "}
        <Link to={item.url}>{t("Visa")}</Link>
      </p>
      {item.reasons.length > 0 && (
        <ul className="content-report__reasons" aria-label={t("Skäl som angavs")}>
          {item.reasons.map((r, i) => (
            <li key={i}>”{r}”</li>
          ))}
        </ul>
      )}
      <div className="content-report__actions">
        <label className="form__field">
          <span>{t("Skäl som ägaren får se")}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t("Välj skäl…")}</option>
            {Object.entries(reasons).map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>{t("Tillägg (valfritt)")}</span>
          <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="button-row">
          <button
            type="button"
            className="button button--danger"
            disabled={busy || !reason}
            onClick={() => {
              if (window.confirm(t("{action}? Ägaren får en notis med skälet.", { action: REMOVE_LABEL[item.type] })))
                void run(() => removeReportedContent(token, item.type, item.id, reason, note));
            }}
          >
            {REMOVE_LABEL[item.type]}
          </button>
          <button type="button" className="button" disabled={busy} onClick={() => void run(() => dismissContentReports(token, item.type, item.id))}>
            {t("Inget fel – avfärda")}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </article>
  );
}
