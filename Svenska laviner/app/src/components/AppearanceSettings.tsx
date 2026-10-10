import { useState } from "react";
import { fieldMode, setFieldMode, setThemeChoice, themeChoice, type ThemeChoice } from "../services/appearance";
import { t } from "../i18n";
import Icon, { type IconName } from "./Icon";

const CHOICES: Array<[ThemeChoice, IconName, string]> = [
  ["auto", "globe", t("Som telefonen")],
  ["light", "sun", t("Ljust")],
  ["dark", "moon", t("Mörkt")],
];

/** Light/dark/auto and field mode, saved on this device. */
export default function AppearanceSettings() {
  const [theme, setTheme] = useState(themeChoice);
  const [field, setField] = useState(fieldMode);
  return (
    <div className="appearance">
      <fieldset className="appearance__themes">
        <legend>{t("Tema")}</legend>
        {CHOICES.map(([id, icon, label]) => (
          <label key={id} className={theme === id ? "appearance__choice appearance__choice--on" : "appearance__choice"}>
            <input
              type="radio"
              name="theme"
              value={id}
              checked={theme === id}
              onChange={() => {
                setThemeChoice(id);
                setTheme(id);
              }}
            />
            <Icon name={icon} size={20} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="appearance__field">
        <input
          type="checkbox"
          checked={field}
          onChange={(e) => {
            setFieldMode(e.target.checked);
            setField(e.target.checked);
          }}
        />
        <span>
          <strong>{t("Fältläge")}</strong>
          {t("Större text och knappar, lättare att träffa med handskar och läsa i starkt solljus.")}
        </span>
      </label>
    </div>
  );
}
