import { Link } from "react-router-dom";
import { t } from "../../i18n";
import Icon from "../Icon";

/** The three things people most often want next from the start page. */
export default function QuickActions() {
  return (
    <nav className="quick-actions" aria-label={t("Snabbval")}>
      <Link to="/karta?planera=1" className="quick-actions__item quick-actions__item--primary">
        <Icon name="route" size={22} />
        {t("Planera rutt")}
      </Link>
      <Link to="/observationer/snabb" className="quick-actions__item">
        <Icon name="pin" size={22} />
        {t("Observera")}
      </Link>
      <Link to="/dela-position" className="quick-actions__item">
        <Icon name="people" size={22} />
        {t("Dela position")}
      </Link>
      <Link to="/offline" className="quick-actions__item">
        <Icon name="cloudOff" size={22} />
        {t("Utan täckning")}
      </Link>
    </nav>
  );
}
