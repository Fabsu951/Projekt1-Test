import { useEffect, useState } from "react";
import { loadSnowDepth, type SnowStation } from "../services/snowDepthService";
import { loadSnowModel, SENORGE_PAGE, type SnowCell } from "../services/snowModelService";
import { fetchSnowfall, type SnowfallOutlook } from "../services/weatherService";
import { cached } from "../services/cache";
import { t, locale } from "../i18n";
import Icon from "./Icon";
import { snowRange } from "../utils/snowRange";

function measured(iso: string): string {
  return new Date(iso).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function day(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
}

function change(cm: number | null): string | null {
  if (cm === null) return null;
  if (cm === 0) return t("oförändrat på 3 dygn");
  return t("{change} cm på 3 dygn", { change: `${cm > 0 ? "+" : "−"}${Math.abs(cm)}` });
}

function weekChange(cm: number | null): string | null {
  if (cm === null) return null;
  if (cm === 0) return t("oförändrat senaste veckan");
  return t("{change} cm senaste veckan", { change: `${cm > 0 ? "+" : "−"}${Math.abs(cm)}` });
}

interface Props {
  regionId: string;
  lat: number;
  lon: number;
}

/**
 * "Snödjup": modelled depth on the mountain at three heights (seNorge),
 * snow expected in SMHI's forecast, and measured depth at SMHI's nearest
 * stations. Each part shows only when it has something; the section is
 * hidden when none does.
 */
export default function SnowDepthCard({ regionId, lat, lon }: Props) {
  const [stations, setStations] = useState<SnowStation[] | null>(null);
  const [cells, setCells] = useState<SnowCell[] | null>(null);
  const [snowfall, setSnowfall] = useState<SnowfallOutlook | null>(null);

  useEffect(() => {
    let live = true;
    loadSnowDepth(regionId, lat, lon)
      .then((list) => live && setStations(list))
      .catch(() => live && setStations([]));
    loadSnowModel(regionId).then((list) => live && setCells(list));
    cached(`snowfall:${regionId}`, () => fetchSnowfall(lat, lon))
      .then((s) => live && setSnowfall(s))
      .catch(() => live && setSnowfall(null));
    return () => {
      live = false;
    };
  }, [regionId, lat, lon]);

  const hasCells = !!cells && cells.length > 0;
  const hasStations = !!stations && stations.length > 0;
  if (!hasCells && !snowfall && !hasStations) return null;

  return (
    <section className="section">
      <h2>{t("Snödjup")}</h2>

      {hasCells && (
        <>
          <h3 className="snow-depth__heading">{t("På fjället, beräknat")}</h3>
          <ul className="snow-depth">
            {cells.map((c) => (
              <li key={`${c.lat},${c.lon}`} className="snow-depth__station">
                <span className="snow-depth__value">{c.depthCm === 0 ? t("Ingen snö") : `${c.depthCm} cm`}</span>
                <span className="snow-depth__info">
                  <strong>{c.altitude !== null ? t("{m} m ö.h.", { m: c.altitude.toLocaleString(locale()) }) : t("Okänd höjd")}</strong>
                  <span className="muted">
                    {[weekChange(c.weekChangeCm), c.newSnow3dCm ? t("{cm} cm nysnö senaste 3 dygnen", { cm: c.newSnow3dCm }) : null]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="muted snow-depth__note">
            {t("Modellberäkning för {day} från NVE och MET Norway (seNorge), för rutor på 1 × 1 km. Den är inte utvärderad på svensk sida. Vinden flyttar snön, så det kan finnas mycket mer eller mindre där du åker, och siffrorna säger inget om lavinfaran.", { day: day(cells[0].date) })}{" "}
            <a href={SENORGE_PAGE} target="_blank" rel="noreferrer">
              {t("seNorge")}
              <Icon name="external" className="icon--link" />
            </a>
          </p>
        </>
      )}

      {snowfall && (
        <>
          <h3 className="snow-depth__heading">{t("Väntat snöfall")}</h3>
          <dl className="snow-depth__fall">
            <div>
              <dt>{t("Nästa dygn")}</dt>
              <dd>{snowRange(snowfall.next24hMm) ?? t("Ingen nämnvärd snö")}</dd>
            </div>
            <div>
              <dt>{t("Nästa 3 dygn")}</dt>
              <dd>{snowRange(snowfall.next72hMm) ?? t("Ingen nämnvärd snö")}</dd>
            </div>
          </dl>
          <p className="muted snow-depth__note">
            {t("Från SMHI:s prognos för områdets mittpunkt: {mm} mm nederbörd som snö de närmaste 3 dygnen. En millimeter blir oftast 1–2 cm nysnö, och vinden samlar snön i läsidor.", {
              mm: snowfall.next72hMm.toLocaleString(locale()),
            })}
          </p>
        </>
      )}

      {hasStations && (
        <>
          <h3 className="snow-depth__heading">{t("Vid SMHI:s mätstationer")}</h3>
          <ul className="snow-depth">
            {stations.map((s) => (
              <li key={s.id} className="snow-depth__station">
                <span className="snow-depth__value">{s.depthCm === 0 ? t("Barmark") : `${s.depthCm} cm`}</span>
                <span className="snow-depth__info">
                  <strong>{s.name}</strong>
                  <span className="muted">
                    {[s.heightM !== null ? t("{m} m ö.h.", { m: s.heightM }) : null, t("{km} km bort", { km: Math.round(s.distanceKm) }), change(s.changeCm)]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  <span className="muted">{t("Mätt")}{" "}{measured(s.measuredAt)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="muted snow-depth__note">
            {t("Uppmätt av SMHI en gång om dygnet, oftast i dalgång eller by. Snödjupet på fjället kan vara helt annat, och vinden flyttar snön. Källa: SMHI:s öppna data.")}
          </p>
        </>
      )}
    </section>
  );
}
