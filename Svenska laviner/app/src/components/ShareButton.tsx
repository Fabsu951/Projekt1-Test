import { useState } from "react";
import { sharePage } from "../services/native";

interface Props {
  /** Path in the app, e.g. /omrade/kebnekaisefjallen */
  path: string;
  title: string;
  text: string;
  /** What is shared, for screen readers ("prognosen för Kebnekaisefjällen"). */
  what: string;
}

/** An icon button that opens the share sheet, or copies the link where there is none. */
export default function ShareButton({ path, title, text, what }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  async function onClick() {
    const outcome = await sharePage(path, title, text);
    setStatus(outcome === "copied" ? "Länken är kopierad" : outcome === "failed" ? "Kunde inte dela länken" : null);
  }

  return (
    <span className="share-button-wrap">
      <button
        type="button"
        className="favorite-button share-button"
        aria-label={`Dela ${what}`}
        title="Dela"
        onClick={() => void onClick()}
      >
        <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
          <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7.5h14V12" />
        </svg>
      </button>
      <span className="share-button__status" role="status">
        {status}
      </span>
    </span>
  );
}
