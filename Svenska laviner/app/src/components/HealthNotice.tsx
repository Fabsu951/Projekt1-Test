import { lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";

const HealthImportNotice = lazy(() => import("./HealthImportNotice"));

/** Only the Android/iPhone app reads the health store, so the website never loads that code. */
export default function HealthNotice({ invite = false }: { invite?: boolean }) {
  if (!Capacitor.isNativePlatform()) return null;
  return (
    <Suspense fallback={null}>
      <HealthImportNotice invite={invite} />
    </Suspense>
  );
}
