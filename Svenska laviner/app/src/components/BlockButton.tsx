import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { setBlocked } from "../services/socialService";
import { t } from "../i18n";

/**
 * Block or unblock someone. Blocking works both ways: you stop seeing each
 * other's tours, observations and comments and can't follow each other.
 */
export default function BlockButton({
  personId,
  name,
  blocked,
  onChange,
}: {
  personId: number;
  name: string;
  blocked: boolean;
  onChange?: (blocked: boolean) => void;
}) {
  const { user, token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user || !token || user.id === personId) return null;

  async function toggle() {
    if (!token) return;
    if (
      !blocked &&
      !window.confirm(
        t("Blockera {name}? Ni ser inte längre varandras turer, observationer eller kommentarer och kan inte följa varandra. {name} får inget besked om det.", { name })
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await setBlocked(token, personId, !blocked);
      onChange?.(!blocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button" disabled={busy} onClick={() => void toggle()}>
        {blocked ? t("Sluta blockera") : t("Blockera")}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
