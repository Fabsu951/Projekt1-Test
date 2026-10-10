import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import { api } from "../services/api";
import { t } from "../i18n";

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"working" | "done" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(token ? "" : t("Länken saknar kod."));
  // Tokens are single-use; StrictMode's double effect must not spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/auth/verify", { method: "POST", json: { token } })
      .then(async () => {
        setStatus("done");
        await refreshUser().catch(() => undefined);
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token, refreshUser]);

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>{t("Bekräfta e-post")}</h1>
      </header>
      {status === "working" && <PageLoading label={t("Bekräftar…")} />}
      {status === "done" && (
        <>
          <p className="notice" role="status">{t("Tack! Din e-postadress är bekräftad och du kan nu dela observationer.")}</p>
          <p>
            <Link to={user ? "/observationer/ny" : "/logga-in?next=/observationer/ny"} className="button button--primary">
              {t("Dela en observation")}
            </Link>
          </p>
        </>
      )}
      {status === "error" && (
        <p className="error" role="alert">
          {message}{" "}{t("Du kan skicka ett nytt bekräftelsemejl från")}{" "}<Link to="/profil">{t("din profil")}</Link>.
        </p>
      )}
    </div>
  );
}
