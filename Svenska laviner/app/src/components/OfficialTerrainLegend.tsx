import { useState } from "react";
import { officialTerrainLegendUrl, type OfficialTerrain } from "../services/mapTiles";
import { t } from "../i18n";

const NAMES: Record<OfficialTerrain, string> = { lutning: "lutning", riktning: "sluttningsriktning" };

/** The legend exactly as Naturvårdsverket draws it (their GetLegendGraphic), via the worker. */
export default function OfficialTerrainLegend({ layer }: { layer: OfficialTerrain }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === layer) {
    return <p className="muted official-terrain__legend-missing">{t("Teckenförklaringen kunde inte hämtas just nu.")}</p>;
  }
  return (
    <img
      key={layer}
      className="official-terrain__legend"
      src={officialTerrainLegendUrl(layer)}
      alt={t("Teckenförklaring för {layer} (Naturvårdsverket)", { layer: NAMES[layer] })}
      onError={() => setFailed(layer)}
    />
  );
}
