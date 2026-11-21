import { useState } from "react";
import { NORWAY_RUNOUT_LEGEND, NORWAY_SLOPE_LEGEND, officialTerrainAvailable, officialTerrainLegendUrl, type OfficialTerrain } from "../services/mapTiles";
import { t } from "../i18n";

const NAMES: Record<OfficialTerrain, string> = { lutning: "lutning" };

/** The legend exactly as Naturvårdsverket draws it (their GetLegendGraphic), via the worker. */
export default function OfficialTerrainLegend({ layer, norway = true }: { layer: OfficialTerrain; norway?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <>
      {failed === layer ? (
        <p className="muted official-terrain__legend-missing">{t("Teckenförklaringen kunde inte hämtas just nu.")}</p>
      ) : (
        <img
          key={layer}
          className="official-terrain__legend"
          src={officialTerrainLegendUrl(layer)}
          alt={t("Teckenförklaring för {layer} (Naturvårdsverket)", { layer: NAMES[layer] })}
          onError={() => setFailed(layer)}
        />
      )}
      {layer === "lutning" && norway && (
        <>
          <p className="official-terrain__title">{t("I Norge (NVE)")}</p>
          <div className="slope-legend">
            {NORWAY_SLOPE_LEGEND.map(([label, color]) => (
              <span key={label} className="slope-legend__item">
                <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * The runout zones: the three blues (NVE's in Norway, the same in Snöläge's
 * Swedish map), NVE's slope classes from 30° and, with the Swedish zones,
 * Naturvårdsverket's slope legend for the Swedish side.
 */
export function RunoutLegend({ sweden = false }: { sweden?: boolean }) {
  return (
    <>
      {sweden && officialTerrainAvailable && (
        <>
          <p className="official-terrain__title">{t("Lutning i Sverige (Naturvårdsverket)")}</p>
          <OfficialTerrainLegend layer="lutning" norway={false} />
          <p className="official-terrain__title">{t("Lutning i Norge (NVE)")}</p>
        </>
      )}
      <div className="slope-legend">
        {NORWAY_SLOPE_LEGEND.slice(1).map(([label, color]) => (
          <span key={label} className="slope-legend__item">
            <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
      <p className="official-terrain__title">{t("Utlöpszoner")}</p>
      <div className="slope-legend">
        {NORWAY_RUNOUT_LEGEND.map(([label, color]) => (
          <span key={label} className="slope-legend__item">
            <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
