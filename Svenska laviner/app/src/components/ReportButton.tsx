import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { reportContent, type ReportType } from "../services/reportService";
import { t } from "../i18n";

const WHAT: Record<ReportType, string> = {
  tour: t("Varför är turen olämplig? (valfritt)"),
  route: t("Varför är rutten olämplig? (valfritt)"),
  comment: t("Varför är kommentaren olämplig? (valfritt)"),
  profile: t("Varför är profilen olämplig? (valfritt)"),
};

interface Props {
  type: ReportType;
  id: number;
  /** Hidden for the owner: you can't report your own things. */
  ownerId: number;
  className?: string;
  /** Button text; "Anmäl" unless the place needs it spelled out. */
  label?: string;
}

/** "Anmäl": asks for an optional reason and sends the report. */
export default function ReportButton({ type, id, ownerId, className = "link-button", label = t("Anmäl") }: Props) {
  const { user, token } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!user?.canPost || !token || user.id === ownerId) return null;
  if (state === "done") return <span className="report-button__done">{t("Anmäld – tack!")}</span>;

  async function onClick() {
    const reason = window.prompt(WHAT[type]);
    if (reason === null) return;
    setState("busy");
    setError(null);
    try {
      await reportContent(token!, type, id, reason);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : t("Kunde inte skicka anmälan."));
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={state === "busy"} onClick={() => void onClick()}>
        {label}
      </button>
      {error && (
        <span className="error" role="alert">
          {" "}
          {error}
        </span>
      )}
    </>
  );
}
