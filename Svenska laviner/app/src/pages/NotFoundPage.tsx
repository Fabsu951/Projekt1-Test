import { Link } from "react-router-dom";
import { usePageTitle } from "../components/pageTitle";
import { t } from "../i18n";

/** Any address the app doesn't know. */
export default function NotFoundPage() {
  usePageTitle(t("Sidan finns inte"));
  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Sidan finns inte")}</h1>
        <p className="page__lead">{t("Länken kan vara gammal eller felstavad.")}</p>
      </header>
      <div className="button-row">
        <Link to="/" className="button button--primary">
          {t("Till lavinprognoserna")}
        </Link>
        <Link to="/karta" className="button">
          {t("Kartan")}
        </Link>
      </div>
    </div>
  );
}
