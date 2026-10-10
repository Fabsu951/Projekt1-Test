import { useFavorites } from "../favorites/useFavorites";
import { useRegionPush } from "../hooks/useRegionPush";
import { t } from "../i18n";

/**
 * "Notiser när farograden ändras" for the starred regions (see
 * useRegionPush). Hidden where notifications don't work.
 */
export default function PushToggle() {
  const { favorites } = useFavorites();
  const { available, enabled, busy, message, set } = useRegionPush();
  if (!available || favorites.length === 0) return null;

  return (
    <div className="push-toggle">
      <label className="push-toggle__label">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={() => void set(!enabled)} />
        {t("Notis när farograden ändras i mina områden")}
      </label>
      {message && (
        <p className="push-toggle__message" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
