import { useEffect, useState } from "react";
import { REGIONS } from "../data/regions";
import { fetchAllForecasts } from "../services/avalancheService";
import type { AvalancheForecast } from "../types/avalanche";
import RegionCard from "../components/RegionCard";

export default function RegionList() {
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});

  useEffect(() => {
    fetchAllForecasts().then((list) => {
      const byId: Record<string, AvalancheForecast> = {};
      for (const f of list) byId[f.regionId] = f;
      setForecasts(byId);
    });
  }, []);

  const anyPlaceholder = Object.values(forecasts).some((f) => f.isPlaceholder);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Områden</h1>
        <p className="page__lead">
          Samlad lavinprognos, väder och säkerhetsinfo för svenska fjällen.
        </p>
      </header>

      {anyPlaceholder && (
        <div className="notice">
          Lavinprognoserna nedan är exempeldata i väntan på inkoppling mot
          Naturvårdsverkets officiella källa.
        </div>
      )}

      <div className="region-list">
        {REGIONS.map((region) => (
          <RegionCard key={region.id} region={region} forecast={forecasts[region.id]} />
        ))}
      </div>
    </div>
  );
}
