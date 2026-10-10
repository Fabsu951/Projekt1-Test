import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyFollows } from "../services/socialService";
import { answerInvitation, inviteToTrip, type TripInvitation, type TripPlan } from "../services/tripService";
import { t } from "../i18n";

// "Gemensam turdag": invitations to other people's tour days in this area,
// and inviting the people you follow to yours.

interface InvitationsProps {
  token: string;
  invitations: TripInvitation[];
  dayLabel: (date: string) => string;
  /** After an answer: reload plans and invitations. */
  onAnswered: () => void;
}

export function TripInvitations({ token, invitations, dayLabel, onAnswered }: InvitationsProps) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (invitations.length === 0) return null;

  async function answer(id: number, accept: boolean) {
    setBusy(id);
    setError(null);
    try {
      await answerInvitation(token, id, accept);
      onAnswered();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att spara."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="trip-invitations" aria-label={t("Inbjudningar")}>
      {invitations.map((inv) => (
        <li key={inv.id} className="trip-invitation">
          <p>
            {t("{name} bjuder in dig till en tur {day}.", { name: inv.from.displayName, day: dayLabel(inv.date) })}
            {inv.routeTitle && <> {t("Rutt: {title}.", { title: inv.routeTitle })}</>}
          </p>
          <div className="button-row">
            <button type="button" className="button button--primary" disabled={busy !== null} onClick={() => void answer(inv.id, true)}>
              {t("Gå med")}
            </button>
            <button type="button" className="button" disabled={busy !== null} onClick={() => void answer(inv.id, false)}>
              {t("Tacka nej")}
            </button>
          </div>
        </li>
      ))}
      {error && (
        <li className="error" role="alert">
          {error}
        </li>
      )}
    </ul>
  );
}

const STATUS: Record<string, string> = {
  pending: t("väntar på svar"),
  accepted: t("hänger med"),
  declined: t("tackade nej"),
};

interface InviteProps {
  token: string;
  trip: TripPlan;
  /** After inviting: the trip with its new invites. */
  onChange: (trip: TripPlan) => void;
}

/** Who is coming on one of your days, and inviting more of the people you follow. */
export function TripInviteBox({ token, trip, onChange }: InviteProps) {
  const [people, setPeople] = useState<Array<{ id: number; displayName: string }> | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invited = new Set((trip.invites ?? []).map((i) => i.user.id));

  async function open() {
    setError(null);
    try {
      const { following } = await fetchMyFollows(token);
      setPeople(following.map((p) => ({ id: p.id, displayName: p.displayName })));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Något gick fel."));
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const invites = await inviteToTrip(token, trip.id, [...picked]);
      onChange({ ...trip, invites });
      setPeople(null);
      setPicked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att skicka."));
    } finally {
      setBusy(false);
    }
  }

  const choices = (people ?? []).filter((p) => !invited.has(p.id));
  return (
    <div className="trip-company">
      {(trip.company?.length ?? 0) > 0 && (
        <p className="muted">{t("Med på turen: {names}", { names: trip.company!.map((p) => p.displayName).join(", ") })}</p>
      )}
      {(trip.invites?.length ?? 0) > 0 && (
        <p className="muted">
          {t("Inbjudna: {list}", { list: trip.invites!.map((i) => `${i.user.displayName} (${STATUS[i.status]})`).join(", ") })}
        </p>
      )}
      {people === null ? (
        <button type="button" className="link-button" onClick={() => void open()}>
          {t("Bjud in kompisar")}
        </button>
      ) : choices.length === 0 ? (
        <p className="muted">
          {people.length === 0 ? (
            <>
              {t("Du kan bjuda in dem du följer.")} <Link to="/flode">{t("Hitta kompisar i flödet")}</Link>
            </>
          ) : (
            t("Alla du följer är redan inbjudna.")
          )}
        </p>
      ) : (
        <fieldset className="trip-company__pick">
          <legend>{t("Bjud in till turen")}</legend>
          {choices.map((p) => (
            <label key={p.id} className="push-toggle__label">
              <input
                type="checkbox"
                checked={picked.has(p.id)}
                onChange={(e) =>
                  setPicked((s) => {
                    const next = new Set(s);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    return next;
                  })
                }
              />
              {p.displayName}
            </label>
          ))}
          <div className="button-row">
            <button type="button" className="button button--primary" disabled={busy || picked.size === 0} onClick={() => void send()}>
              {t("Skicka inbjudan")}
            </button>
            <button type="button" className="button" onClick={() => setPeople(null)}>
              {t("Avbryt")}
            </button>
          </div>
          <p className="muted">{t("De får en notis och kan gå med eller tacka nej. Går de med får de också prognosen för dagen.")}</p>
        </fieldset>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
