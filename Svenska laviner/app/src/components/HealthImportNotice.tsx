import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { checkForNewWorkouts, healthConnected, healthImportSupported, type AutoImportResult } from "../services/healthImport";

/**
 * In the Android app once Health Connect is connected: adds new ski sessions
 * as private tours when automatic import is on, and says what happened or
 * what waits ("3 nya pass från klockan"). Before connecting, `invite` shows
 * an invitation instead. Nothing on the web or in the iPhone app.
 */
export default function HealthImportNotice({ invite = false }: { invite?: boolean }) {
  const { user, token } = useAuth();
  const [result, setResult] = useState<AutoImportResult | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !token || !healthImportSupported()) return;
    let live = true;
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
    return () => {
      live = false;
    };
  }, [user, token]);

  if (!user || !healthImportSupported()) return null;

  if (connected === false && invite) {
    return (
      <Link to="/turer/halsa" className="health-notice health-notice--invite">
        <strong>Hämta turer från Health Connect</strong>
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
