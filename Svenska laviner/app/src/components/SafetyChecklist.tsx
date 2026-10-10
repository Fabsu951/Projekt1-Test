import SourceList from "./SourceList";
import { t } from "../i18n";

const ITEMS = [
  t("Lavinsändare (ARVA/transceiver) – testad och laddad"),
  t("Lavinspade"),
  t("Lavinsond"),
  t("Åk aldrig ensam i lavinterräng"),
  t("Ett i taget i brant terräng, övriga observerar från säker plats"),
  t("Kolla dagens lavinprognos och väderprognos innan du ger dig av"),
  t("Berätta för någon vart du ska och när du är tillbaka"),
  t("Ha en plan för hur ni larmar SOS Alarm (112) vid olycka"),
];

export default function SafetyChecklist() {
  return (
    <div className="safety-checklist">
      <h3>{t("Innan du åker")}</h3>
      <ul>
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="safety-checklist__emergency">
        {t("Nödnummer:")}{" "}<strong>112</strong>
      </p>
      <SourceList
        sources={[
          {
            label: "Fjällsäkerhetsrådet",
            url: "https://www.fjallsakerhetsradet.se/forbered-fjallturen/lavinsakerhet/",
          },
        ]}
      />
    </div>
  );
}
