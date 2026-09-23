import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { safeNext } from "../utils/safeNext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registreringen misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>Skapa konto</h1>
        <p className="page__lead">Med ett konto kan du dela lavinobservationer med andra åkare.</p>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          Användarnamn <span className="form__hint">(visas på dina observationer)</span>
          <input
            autoComplete="nickname"
            required
            minLength={3}
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="form__field">
          E-post <span className="form__hint">(visas aldrig för andra)</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="form__field">
          Lösenord <span className="form__hint">(minst 10 tecken)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="form__privacy">
          Vi sparar din e-post, ditt användarnamn och det du publicerar. Du kan när som helst radera ditt
          konto från profilsidan, och då tas allt du delat bort. Läs mer i vår{" "}
          <Link to="/om-appen#integritet">integritetspolicy</Link>.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Skapar konto…" : "Skapa konto"}
        </button>
      </form>
      <p className="form__alt">
        Har du redan ett konto? <Link to={`/logga-in?next=${encodeURIComponent(next)}`}>Logga in</Link>
      </p>
    </div>
  );
}
