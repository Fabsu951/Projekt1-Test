import type { Elevation } from "../types/avalanche";
import { t } from "../i18n";

/** The elevation bands as lavinprognoser.se names them. */
export const ELEVATION_LABELS: Record<Elevation, string> = {
  kalfjall: t("Kalfjället"),
  tradgrans: t("Trädgränsen"),
  under_tradgrans: t("Under trädgränsen"),
};
