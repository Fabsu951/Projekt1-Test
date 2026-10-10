import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { t } from "../i18n";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setError(t("Lösenorden matchar inte."));
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      navigate("/profil", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Något gick fel."));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="page page--narrow">
        <h1>{t("Ogiltig länk")}</h1>
        <p>
          {t("Länken saknar kod.")}{" "}<Link to="/glomt-losenord">{t("Begär en ny länk")}</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>{t("Nytt lösenord")}</h1>
        <p className="page__lead">{t("Du loggas ut från alla andra enheter när lösenordet byts.")}</p>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          {t("Nytt lösenord")}{" "}<span className="form__hint">{t("(minst 10 tecken)")}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="form__field">
          {t("Upprepa lösenordet")}
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error} {error.includes(t("Begär en ny")) && <Link to="/glomt-losenord">{t("Begär en ny länk")}</Link>}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? t("Sparar…") : t("Spara nytt lösenord")}
        </button>
      </form>
    </div>
  );
}
