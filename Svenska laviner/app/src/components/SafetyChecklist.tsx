const ITEMS = [
  "Lavinsändare (ARVA/transceiver) — testad och laddad",
  "Lavinspade",
  "Lavinsond",
  "Åk aldrig ensam i lavinterräng",
  "Ett i taget i brant terräng, övriga observerar från säker plats",
  "Kolla dagens lavinprognos och väderprognos innan du ger dig av",
  "Berätta för någon vart du ska och när du är tillbaka",
  "Ha en plan för hur ni larmar SOS Alarm (112) vid olycka",
];

export default function SafetyChecklist() {
  return (
    <div className="safety-checklist">
      <h3>Innan du åker</h3>
      <ul>
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="safety-checklist__emergency">
        Nödnummer: <strong>112</strong>
      </p>
    </div>
  );
}
