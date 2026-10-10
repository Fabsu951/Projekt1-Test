import { t } from "../i18n";
interface Props {
  label?: string;
}

export default function PageLoading({ label = t("Laddar…") }: Props) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
