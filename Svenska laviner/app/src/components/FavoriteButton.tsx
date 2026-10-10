import { useFavorites } from "../favorites/useFavorites";
import { t } from "../i18n";

interface Props {
  regionId: string;
  regionName: string;
}

/** A star that saves a region to "Mina områden" on this device. */
export default function FavoriteButton({ regionId, regionName }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const on = isFavorite(regionId);
  return (
    <button
      type="button"
      className={on ? "favorite-button favorite-button--on" : "favorite-button"}
      aria-pressed={on}
      aria-label={on ? t("Ta bort {name} från mina områden", { name: regionName }) : t("Spara {name} i mina områden", { name: regionName })}
      title={on ? t("Ta bort från mina områden") : t("Spara i mina områden")}
      onClick={() => toggleFavorite(regionId)}
    >
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
      </svg>
    </button>
  );
}
