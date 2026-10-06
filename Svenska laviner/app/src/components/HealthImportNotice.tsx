import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { findNewWorkouts, healthConnected, healthImportSupported } from "../services/healthImport";

/**
 * In the Android app: "3 nya pass från klockan" once Health Connect is
 * connected, or an invitation to connect it (`invite`). Nothing elsewhere.
 */
export default function HealthImportNotice({ invite = false }: { invite?: boolean }) {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user || !healthImportSupported()) return;
    let live = true;
    healthConnected()
      .then(async (on) => {
        if (!live) return;
        setConnected(on);
        if (on) {
          const found = await findNewWorkouts();
          if (live) setCount(found.length);
        }
      })
      .catch(() => live && setCount(null));
    return () => {
      live = false;
    };
  }, [user]);

  if (!user || !healthImportSupported()) return null;
  if (connected && count) {
    return (
      <Link to="/turer/halsa" className="health-notice">
        <strong>{count === 1 ? "1 nytt pass" : `${count} nya pass`} från klockan</strong>
        <span>Granska och lägg till i turdagboken →</span>
      </Link>
    );
  }
  if (!connected && invite) {
    return (
      <Link to="/turer/halsa" className="health-notice health-notice--invite">
        <strong>Hämta turer från Health Connect</strong>
        <span>Pass med GPS-spår från klockan, utan att ladda upp filer →</span>
      </Link>
    );
  }
  return null;
}
