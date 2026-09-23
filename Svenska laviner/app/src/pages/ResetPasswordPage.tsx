import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

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
    if (password !== repeat) return setError("Lösenorden matchar inte.");
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      navigate("/profil", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="page page--narrow">
        <h1>Ogiltig länk</h1>
        <p>
          Länken saknar kod. <Link to="/glomt-losenord">Begär en ny länk</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>Nytt lösenord</h1>
        <p className="page__lead">Du loggas ut från alla andra enheter när lösenordet byts.</p>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          Nytt lösenord <span className="form__hint">(minst 10 tecken)</span>
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
          Upprepa lösenordet
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
            {error} {error.includes("Begär en ny") && <Link to="/glomt-losenord">Begär en ny länk</Link>}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Sparar…" : "Spara nytt lösenord"}
        </button>
      </form>
    </div>
  );
}
