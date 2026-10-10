import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import TourCard from "../components/TourCard";
import { REGIONS } from "../data/regions";
import SeasonFilter from "../components/SeasonFilter";
import { seasonMonths } from "../data/tourSeasons";
import { fetchTours } from "../services/tourService";
import type { Tour } from "../types/tour";
import HealthImportNotice from "../components/HealthImportNotice";
import { t } from "../i18n";

export default function ToursPage() {
  const { user, token } = useAuth();
  const [region, setRegion] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const months = seasonMonths(seasons);
    fetchTours({ region: region || undefined, months, token })
      .then((list) => {
        if (cancelled) return;
        setError(null);
        setTours(list);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [region, seasons, token]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Turer")}</h1>
        <p className="page__lead">
          {t("Turer som andra åkare delat, med spår, höjdmeter och när på säsongen de gjordes. Bra för att planera nästa tur.")}
        </p>
        <div className="button-row">
          <Link to="/karta?turer=varmekarta" className="button">
            {t("Visa värmekarta")}
          </Link>
          <Link to={user ? "/turer/ny" : "/logga-in?next=/turer/ny"} className="button button--primary">
            {t("+ Lägg till tur från klockan")}
          </Link>
        </div>
      </header>

      <HealthImportNotice invite />

      <p className="notice">
        {t("Turerna delas av användare. Förhållandena en annan dag kan vara helt andra – kontrollera alltid dagens lavinprognos och gör din egen bedömning.")}
      </p>

      <div className="filter-row">
        <label className="form__field form__field--inline">
          {t("Område")}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t("Alla områden")}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SeasonFilter selected={seasons} onChange={setSeasons} />

      {error && <p className="error">{error}</p>}
      {!tours && !error && <PageLoading label={t("Laddar turer…")} />}
      {tours && tours.length === 0 && <p className="section__intro">{t("Inga turer här än. Dela gärna din senaste!")}</p>}
      <div className="tour-list">{tours?.map((tour) => <TourCard key={tour.id} tour={tour} />)}</div>
    </div>
  );
}
