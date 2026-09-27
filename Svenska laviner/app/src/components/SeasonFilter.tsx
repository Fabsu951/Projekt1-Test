import { TOUR_SEASONS } from "../data/tourSeasons";

/** Chips for picking parts of the ski season; none picked means the whole year. */
export default function SeasonFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="season-filter">
      <legend>När på säsongen</legend>
      {TOUR_SEASONS.map((s) => (
        <label key={s.id} className={selected.includes(s.id) ? "chip chip--on" : "chip"}>
          <input
            type="checkbox"
            checked={selected.includes(s.id)}
            onChange={(e) => onChange(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))}
          />
          {s.label}
        </label>
      ))}
    </fieldset>
  );
}
