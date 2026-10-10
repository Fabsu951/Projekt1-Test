import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { t } from "../i18n";

/**
 * Reminder (with resend) for users who must verify before posting. Hidden
 * when the server doesn't require it (email sending not configured yet) —
 * no email was sent then, so the reminder would be wrong.
 */
export default function VerifyEmailNotice() {
  const { user, resendVerification, refreshUser } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const waiting = !!user && !user.canPost;

  // The link in the email usually opens in another tab; check again when
  // the person comes back here, so the notice goes away without a reload.
  useEffect(() => {
    if (!waiting) return;
    const check = () => {
      if (document.visibilityState === "visible") void refreshUser().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [waiting, refreshUser]);

  if (!user || user.canPost) return null;

  async function resend() {
    setState("sending");
    setError(null);
    try {
      await resendVerification();
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Kunde inte skicka mejlet."));
      setState("idle");
    }
  }

  return (
    <div className="notice" role="status">
      <strong>{t("Bekräfta din e-postadress.")}</strong>{" "}{t("Du behöver bekräfta din e-post innan du kan dela eller anmäla observationer. Vi har skickat en länk till")}{" "}<strong>{user.email}</strong>.{" "}
      {state === "sent" ? (
        t("Nytt mejl skickat!")
      ) : (
        <button type="button" className="link-button" onClick={() => void resend()} disabled={state === "sending"}>
          {t("Skicka igen")}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
