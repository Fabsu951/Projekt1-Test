import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { safeNext } from "../utils/safeNext";
import { t } from "../i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Inloggningen misslyckades."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>{t("Logga in")}</h1>
        <p className="page__lead">{t("Logga in för att dela observationer från fjället.")}</p>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          {t("E-post")}
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="form__field">
          {t("Lösenord")}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? t("Loggar in…") : t("Logga in")}
        </button>
      </form>
      <p className="form__alt">
        <Link to="/glomt-losenord">{t("Glömt lösenordet?")}</Link>
      </p>
      <p className="form__alt">
        {t("Inget konto?")}{" "}<Link to={`/registrera?next=${encodeURIComponent(next)}`}>{t("Skapa ett här")}</Link>
      </p>
    </div>
  );
}
