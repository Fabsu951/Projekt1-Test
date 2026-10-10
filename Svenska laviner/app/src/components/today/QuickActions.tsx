import { Link } from "react-router-dom";

/** The three things people most often want next from the start page. */
export default function QuickActions() {
  return (
    <nav className="quick-actions" aria-label="Snabbval">
      <Link to="/karta?planera=1" className="quick-actions__item quick-actions__item--primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="6" r="2" />
          <path d="M7 17 C12 15 10 9 17 7" />
        </svg>
        Planera rutt
      </Link>
      <Link to="/observationer/snabb" className="quick-actions__item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <path d="M12 7v6M9 10h6" />
        </svg>
        Ny observation
      </Link>
      <Link to="/offline" className="quick-actions__item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <path d="M3 3l18 18" />
        </svg>
        Utan täckning
      </Link>
    </nav>
  );
}
