import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { t } from "../i18n";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot", { method: "POST", json: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Något gick fel."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>{t("Glömt lösenordet")}</h1>
        <p className="page__lead">{t("Ange din e-post så skickar vi en länk där du kan välja ett nytt lösenord.")}</p>
      </header>
      {sent ? (
        <p className="notice" role="status">
          {t("Om det finns ett konto för")}{" "}<strong>{email}</strong>{" "}{t("har vi skickat en länk dit. Den gäller i en timme. Hittar du inget mejl, kolla skräpposten.")}
        </p>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <label className="form__field">
            {t("E-post")}
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t("Skickar…") : t("Skicka länk")}
          </button>
        </form>
      )}
      <p className="form__alt">
        <Link to="/logga-in">{t("Tillbaka till inloggningen")}</Link>
      </p>
    </div>
  );
}
