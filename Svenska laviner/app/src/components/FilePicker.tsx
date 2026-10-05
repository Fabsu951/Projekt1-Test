import { useState } from "react";

/**
 * A file input with a Swedish, app-styled button instead of the browser's
 * own ("Choose File / No file chosen"). Put it inside the field's <label>.
 */
export default function FilePicker({
  accept,
  buttonLabel = "Välj fil",
  onFile,
}: {
  accept: string;
  buttonLabel?: string;
  onFile: (file: File | undefined) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <span className="file-picker">
      <input
        type="file"
        accept={accept}
        className="file-picker__input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setName(file?.name ?? null);
          onFile(file);
        }}
      />
      <span className="button file-picker__button" aria-hidden="true">
        {buttonLabel}
      </span>
      <span className="file-picker__name">{name ?? "Ingen fil vald"}</span>
    </span>
  );
}
