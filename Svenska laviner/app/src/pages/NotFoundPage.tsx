import { Link } from "react-router-dom";
import { usePageTitle } from "../components/pageTitle";

/** Any address the app doesn't know. */
export default function NotFoundPage() {
  usePageTitle("Sidan finns inte");
  return (
    <div className="page">
      <header className="page__header">
        <h1>Sidan finns inte</h1>
        <p className="page__lead">Länken kan vara gammal eller felstavad.</p>
      </header>
      <div className="button-row">
        <Link to="/" className="button button--primary">
          Till lavinprognoserna
        </Link>
        <Link to="/karta" className="button">
          Kartan
        </Link>
      </div>
    </div>
  );
}
