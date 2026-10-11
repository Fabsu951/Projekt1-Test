import { DANGER_SIGNS, dangerSignLabel } from "../data/dangerSigns";
import { toggleTourSign, type TourSigns } from "../data/tourSigns";
import { t } from "../i18n";

export function TourSignsPicker({
  value,
  onChange,
  disabled,
}: {
  value: TourSigns;
  onChange: (next: TourSigns) => void;
  disabled?: boolean;
}) {
  const none = value !== null && value.length === 0;
  return (
    <fieldset className="tour-signs">
      <legend>
        {t("Varningstecken under turen")}{" "}
        <span className="form__hint">{t("(valfritt – även inga varningstecken säger andra något)")}</span>
      </legend>
      <div className="tour-signs__choices">
        {DANGER_SIGNS.map(({ sign, label }) => {
          const on = value?.includes(sign) ?? false;
          return (
            <button
              key={sign}
              type="button"
              className={on ? "chip chip--on" : "chip"}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(toggleTourSign(value, sign))}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          className={none ? "chip chip--on chip--calm" : "chip chip--calm"}
          aria-pressed={none}
          disabled={disabled}
          onClick={() => onChange(toggleTourSign(value, "none"))}
        >
          {t("Inga varningstecken")}
        </button>
      </div>
    </fieldset>
  );
}

/** The answer as small labels on a tour card or page; nothing when not answered. */
export function TourSignsList({ signs }: { signs: TourSigns | undefined }) {
  if (!signs) return null;
  return (
    <ul className="observation-card__details" aria-label={t("Varningstecken under turen")}>
      {signs.length === 0 ? (
        <li className="observation-card__sign observation-card__sign--none">{t("Inga varningstecken")}</li>
      ) : (
        signs.map((sign) => {
          const label = dangerSignLabel(sign);
          return label ? (
            <li key={sign} className="observation-card__sign">
              {label}
            </li>
          ) : null;
        })
      )}
    </ul>
  );
}
