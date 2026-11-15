import { useState } from "react";
import { NORWAY_RUNOUT_LEGEND, NORWAY_SLOPE_LEGEND, officialTerrainLegendUrl, type OfficialTerrain } from "../services/mapTiles";
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

/** NVE's map with runout zones (Norway only): its slope classes from 30° and the three runout blues. */
export function RunoutLegend() {
  return (
    <>
      <div className="slope-legend">
        {NORWAY_SLOPE_LEGEND.slice(1).map(([label, color]) => (
          <span key={label} className="slope-legend__item">
            <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
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
