import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { App } from "@capacitor/app";
import {
  checkForNewWorkouts,
  healthConnected,
  healthImportSupported,
  HEALTH_STORE_NAME,
  type AutoImportResult,
} from "../services/healthImport";

/**
 * In the Android/iPhone app once Health Connect / Apple Hälsa is connected:
 * adds new ski sessions as private tours when automatic import is on — when
 * the app opens and each time it comes back to the foreground — and says
 * what happened or what waits ("3 nya pass från klockan"). Before
 * connecting, `invite` shows an invitation instead. Nothing on the web.
 */
export default function HealthImportNotice({ invite = false }: { invite?: boolean }) {
  const { user, token } = useAuth();
  const [result, setResult] = useState<AutoImportResult | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !token || !healthImportSupported()) return;
    let live = true;
    const check = () =>
      healthConnected()
        .then(async (on) => {
          if (!live) return;
          setConnected(on);
          if (on) {
            const r = await checkForNewWorkouts(token);
            if (live) setResult(r);
          }
        })
        .catch(() => live && setResult(null));
    void check();
    // Back from the watch's app (or after a tour): look again.
    const resumed = App.addListener("resume", () => void check());
    return () => {
      live = false;
      void resumed.then((h) => h.remove());
    };
  }, [user, token]);

  if (!user || !healthImportSupported()) return null;

  if (connected === false && invite) {
    return (
      <Link to="/turer/halsa" className="health-notice health-notice--invite">
        <strong>Hämta turer från {HEALTH_STORE_NAME}</strong>
        <span>Pass med GPS-spår från klockan, utan att ladda upp filer →</span>
      </Link>
    );
  }
  if (!result || (result.imported.length === 0 && result.waiting === 0)) return null;

  const { imported, waiting } = result;
  return (
    <div className="health-notice" role="status">
      {imported.length > 0 && (
        <>
          <strong>
            {imported.length === 1 ? "1 ny tur från klockan" : `${imported.length} nya turer från klockan`} har lagts till som
            privat{imported.length === 1 ? "" : "a"}
          </strong>
          <Link to={imported.length === 1 ? `/turer/${imported[0].id}` : "/profil"}>
            {imported.length === 1 ? `Granska och dela "${imported[0].title}" →` : "Granska och dela under Mina turer →"}
          </Link>
        </>
      )}
      {waiting > 0 && (
        <Link to="/turer/halsa">
          {waiting === 1 ? "1 pass väntar" : `${waiting} pass väntar`} på att du väljer om de ska läggas till →
        </Link>
      )}
    </div>
  );
}
