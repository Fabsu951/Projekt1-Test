import { useState } from "react";
import { useAuth } from "../auth/useAuth";

/**
 * Reminder (with resend) for users who must verify before posting. Hidden
 * when the server doesn't require it (email sending not configured yet) —
 * no email was sent then, so the reminder would be wrong.
 */
export default function VerifyEmailNotice() {
  const { user, resendVerification } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user || user.canPost) return null;

  async function resend() {
    setState("sending");
    setError(null);
    try {
      await resendVerification();
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka mejlet.");
      setState("idle");
    }
  }

  return (
    <div className="notice" role="status">
      <strong>Bekräfta din e-postadress.</strong> Du behöver bekräfta din e-post innan du kan dela eller
      anmäla observationer. Vi har skickat en länk till <strong>{user.email}</strong>.{" "}
      {state === "sent" ? (
        "Nytt mejl skickat!"
      ) : (
        <button type="button" className="link-button" onClick={() => void resend()} disabled={state === "sending"}>
          Skicka igen
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
