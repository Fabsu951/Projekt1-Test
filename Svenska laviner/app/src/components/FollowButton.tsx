import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { setFollowing } from "../services/socialService";
import type { Person } from "../types/social";
import { t } from "../i18n";

/** Follow / stop following someone. Signed-out visitors get a log-in link instead. */
export default function FollowButton({
  personId,
  following,
  onChange,
}: {
  personId: number;
  following: boolean;
  onChange?: (person: Person) => void;
}) {
  const { user, token } = useAuth();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  if (!user || !token) {
    return (
      <Link to={`/logga-in?next=/person/${personId}`} className="button follow-button">
        {t("Följ")}
      </Link>
    );
  }
  if (user.id === personId) return null;

  async function toggle() {
    if (!token) return;
    setBusy(true);
    try {
      const person = await setFollowing(token, personId, !on);
      setOn(person.iFollow);
      onChange?.(person);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={on ? "button follow-button follow-button--on" : "button button--primary follow-button"}
      aria-pressed={on}
      disabled={busy}
      onClick={() => void toggle()}
    >
      {on ? t("Följer ✓") : t("Följ")}
    </button>
  );
}
