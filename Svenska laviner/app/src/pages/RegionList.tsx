import { useEffect, useState } from "react";
import { REGIONS } from "../data/regions";
import { loadForecasts } from "../services/avalancheService";
import type { AvalancheForecast } from "../types/avalanche";
import RegionCard from "../components/RegionCard";
import NearestRegion from "../components/NearestRegion";
import { useFavorites } from "../favorites/useFavorites";

export default function RegionList() {
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});
  const [stale, setStale] = useState(false);
  const { favorites } = useFavorites();

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

      {favorites.length > 0 ? (
        <>
          <h2 className="region-list__heading">Mina områden</h2>
          <div className="region-list">
            {favorites.map((id) => {
              const region = REGIONS.find((r) => r.id === id)!;
              return <RegionCard key={id} region={region} forecast={forecasts[id]} />;
            })}
          </div>
          {favorites.length < REGIONS.length && (
            <>
              <h2 className="region-list__heading">Övriga områden</h2>
              <div className="region-list">
                {REGIONS.filter((r) => !favorites.includes(r.id)).map((region) => (
                  <RegionCard key={region.id} region={region} forecast={forecasts[region.id]} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="region-list">
            {REGIONS.map((region) => (
              <RegionCard key={region.id} region={region} forecast={forecasts[region.id]} />
            ))}
          </div>
          <p className="region-list__hint">Tryck på stjärnan för att lägga ett område överst under Mina områden.</p>
        </>
      )}

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
