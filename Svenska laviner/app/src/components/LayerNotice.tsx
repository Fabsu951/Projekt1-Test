import { t } from "../i18n";

interface Props {
  /** One short line that always shows: the part nobody may miss. */
  short: string;
  /** The whole explanation, behind "Läs mer". */
  full: string;
}

/**
 * The disclaimer under a terrain layer, kept to one line so it doesn't
 * cover the map (it floats on top in full screen). Tapping it opens the
 * whole text.
 */
export default function LayerNotice({ short, full }: Props) {
  return (
    <details className="notice notice--stale layer-notice">
      <summary>
        <span>{short}</span> <span className="layer-notice__more">{t("Läs mer")}</span>
      </summary>
      <p>{full}</p>
    </details>
  );
}
