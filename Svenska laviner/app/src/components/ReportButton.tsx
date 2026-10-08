import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { reportContent, type ReportType } from "../services/reportService";

const WHAT: Record<ReportType, string> = {
  tour: "turen",
  route: "rutten",
  comment: "kommentaren",
  profile: "profilen",
};

interface Props {
  type: ReportType;
  id: number;
  /** Hidden for the owner: you can't report your own things. */
  ownerId: number;
  className?: string;
}

/** "Anmäl": asks for an optional reason and sends the report. */
export default function ReportButton({ type, id, ownerId, className = "link-button" }: Props) {
  const { user, token } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!user?.canPost || !token || user.id === ownerId) return null;
  if (state === "done") return <span className="report-button__done">Anmäld – tack!</span>;

  async function onClick() {
    const reason = window.prompt(`Varför är ${WHAT[type]} olämplig? (valfritt)`);
    if (reason === null) return;
    setState("busy");
    setError(null);
    try {
      await reportContent(token!, type, id, reason);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Kunde inte skicka anmälan.");
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={state === "busy"} onClick={() => void onClick()}>
        Anmäl
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
