import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  backgroundCheckStatus,
  disableBackgroundCheck,
  enableBackgroundCheck,
  type BackgroundCheckStatus,
  type EnableResult,
} from "../services/backgroundImport";
import { t } from "../i18n";

const ios = Capacitor.getPlatform() === "ios";

const WHY_NOT: Record<Exclude<EnableResult, { on: true }>["reason"], string> = ios
  ? {
      notifications: t("Snöläge får inte visa notiser. Tillåt dem under Inställningar → Snöläge → Notiser."),
      background: t("Apple Hälsa kunde inte slå på påminnelserna. Försök igen."),
      workouts: t("Snöläge får inte läsa träningspass. Tillåt det under Inställningar → Hälsa → Dataåtkomst och enheter → Snöläge."),
      error: t("Det gick inte att slå på påminnelserna. Försök igen."),
    }
  : {
      notifications: t("Snöläge får inte visa notiser. Tillåt dem under Inställningar → Appar → Snöläge → Aviseringar."),
      background:
        t("Health Connect gav inte tillåtelse att läsa i bakgrunden. Du kan ändra det i Health Connect → Appbehörigheter → Snöläge."),
      workouts: t("Koppla först Snöläge till Health Connect."),
      error: t("Det gick inte att slå på påminnelserna. Försök igen."),
    };

/** "Påminn mig om nya skidpass" on /turer/halsa, in the apps. */
export default function BackgroundCheckToggle() {
  const [status, setStatus] = useState<BackgroundCheckStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void backgroundCheckStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  if (!status) return null;
  if (!status.supported) {
    return (
      <p className="muted health-background-note">
        {ios
          ? t("Påminnelser om nya skidpass kräver Apple Hälsa, som inte finns på den här enheten.")
          : t("Vill du få en påminnelse när klockan har sparat ett nytt skidpass? Det kräver en nyare Health Connect. Uppdatera den i Play Butik.")}
      </p>
    );
  }

  async function change(on: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      if (on) {
        const result = await enableBackgroundCheck();
        setStatus({ supported: true, on: result.on });
        if (!result.on) setProblem(WHY_NOT[result.reason]);
      } else {
        await disableBackgroundCheck();
        setStatus({ supported: true, on: false });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="health-auto">
        <input type="checkbox" checked={status.on} disabled={busy} onChange={(e) => void change(e.target.checked)} />
        <span>
          <strong>{t("Påminn mig om nya skidpass")}</strong>
          <br />
          {ios
            ? t("Även när appen är stängd säger Apple Hälsa till när klockan har sparat ett nytt skidpass, snöskopass eller en vandring.")
            : t("Ungefär en gång i timmen, även när appen är stängd, kollar telefonen om klockan har sparat ett nytt skidpass, snöskopass eller en vandring.")}{" "}{t("Då får du en notis, och turen läggs till som")}{" "}<strong>{t("privat")}</strong>{" "}{t("när du trycker på den. Ingenting skickas från telefonen innan dess.")}
        </span>
      </label>
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
