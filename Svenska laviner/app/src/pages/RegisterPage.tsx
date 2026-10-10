import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { safeNext } from "../utils/safeNext";
import TurnstileWidget from "../components/TurnstileWidget";
import { t } from "../i18n";

/** Public Turnstile site key; the robot check only appears when it is set at build time. */
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const onTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);
  const onTurnstileLoadError = useCallback(
    () => setError(t("Robotkontrollen kunde inte laddas. Kontrollera anslutningen och ladda om sidan.")),
    []
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError(t("Du behöver godkänna användarvillkoren för att skapa ett konto."));
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(t("Vänta tills robotkontrollen är klar, eller klicka i rutan."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName, turnstileToken);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Registreringen misslyckades."));
      // Each token works once; get a fresh one for the next try.
      if (TURNSTILE_SITE_KEY) setTurnstileReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1>{t("Skapa konto")}</h1>
        <p className="page__lead">{t("Med ett konto kan du dela lavinobservationer med andra åkare.")}</p>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <label className="form__field">
          {t("Användarnamn")}{" "}<span className="form__hint">{t("(visas på dina observationer)")}</span>
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
          {t("E-post")}{" "}<span className="form__hint">{t("(visas aldrig för andra)")}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="form__field">
          {t("Lösenord")}{" "}<span className="form__hint">{t("(minst 10 tecken)")}</span>
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
          {t("Vi sparar din e-post, ditt användarnamn och det du publicerar. Du kan när som helst radera ditt konto från profilsidan, och då tas allt du delat bort. Läs mer i vår")}{" "}
          <Link to="/om-appen#integritet">{t("integritetspolicy")}</Link>.
        </p>
        <label className="form__field form__field--checkbox">
          <input type="checkbox" required checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <span>
            {t("Jag har läst och godkänner")}{" "}<Link to="/om-appen#villkor">{t("användarvillkoren")}</Link>{" "}{t("och är minst 13 år.")}
          </span>
        </label>
        {TURNSTILE_SITE_KEY && (
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onToken={onTurnstileToken}
            resetSignal={turnstileReset}
            onLoadError={onTurnstileLoadError}
          />
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? t("Skapar konto…") : t("Skapa konto")}
        </button>
      </form>
      <p className="form__alt">
        {t("Har du redan ett konto?")}{" "}<Link to={`/logga-in?next=${encodeURIComponent(next)}`}>{t("Logga in")}</Link>
      </p>
    </div>
  );
}
