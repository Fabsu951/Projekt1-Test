import { t } from "../i18n";
/** "Admin" label shown next to the names of the people who moderate Snöläge. */
export default function AdminBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="admin-badge" title={t("Administratör för Snöläge")}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1 L14 3.5 V8 C14 11.4 11.4 14 8 15 C4.6 14 2 11.4 2 8 V3.5 Z" fill="currentColor" />
        <path d="M5.2 8.2 L7.2 10.1 L10.9 6" fill="none" stroke="var(--bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("Admin")}
    </span>
  );
}
