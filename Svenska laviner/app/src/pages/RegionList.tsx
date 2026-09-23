import { useEffect, useState } from "react";
import { REGIONS } from "../data/regions";
import { loadForecasts } from "../services/avalancheService";
import type { AvalancheForecast } from "../types/avalanche";
import RegionCard from "../components/RegionCard";
import NearestRegion from "../components/NearestRegion";

export default function RegionList() {
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});
  const [stale, setStale] = useState(false);

  useEffect(() => {
    loadForecasts().then((result) => {
      setForecasts(result.byId);
      setStale(result.stale);
    });
  }, []);

  const loaded = Object.values(forecasts);
  const allSeasonOver = loaded.length > 0 && loaded.every((f) => f.status === "season-over");

  return (
    <div className="page">
      <header className="page__header">
        <h1>Områden</h1>
        <p className="page__lead">
          Samlad lavinprognos, väder och säkerhetsinfo för svenska fjällen.
        </p>
      </header>

      <div className="nearest-region">
        <NearestRegion />
      </div>

      {allSeasonOver && (
        <div className="notice">
          Prognossäsongen är slut. Naturvårdsverket publicerar lavinprognoser
          mitten av december–mitten av maj.
        </div>
      )}
      {stale && (
        <p className="notice notice--stale">Ingen kontakt just nu — visar senast sparade prognoser.</p>
      )}

      <div className="region-list">
        {REGIONS.map((region) => (
          <RegionCard key={region.id} region={region} forecast={forecasts[region.id]} />
        ))}
      </div>

      <p className="source-list">
        Farograder från Naturvårdsverkets{" "}
        <a href="https://www.lavinprognoser.se/" target="_blank" rel="noreferrer">
          lavinprognoser.se
        </a>
        .
      </p>
    </div>
  );
}
