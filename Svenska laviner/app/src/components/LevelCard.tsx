import type { ReactNode } from "react";
import Avatar from "./Avatar";
import { levelFor, XP_RULES } from "../data/levels";
import type { Person } from "../types/social";

/** Big framed picture, level and progress towards the next frame. */
export default function LevelCard({ person, actions }: { person: Person; actions?: ReactNode }) {
  const { level, next, progress, toNext } = levelFor(person.xp);
  return (
    <div className="level-card">
      <Avatar name={person.displayName} avatarPath={person.avatarPath} xp={person.xp} size={120} />
      <div className="level-card__info">
        <p className="level-card__level">
          {level.name} <span className="level-card__xp">{person.xp} poäng</span>
        </p>
        {next ? (
          <>
            <div
              className="level-card__bar"
              role="progressbar"
              aria-label={`Mot ${next.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="level-card__next">
              {toNext} poäng kvar till {next.name}
            </p>
          </>
        ) : (
          <p className="level-card__next">Högsta nivån!</p>
        )}
        <p className="level-card__stats">
          {person.tours} turer · {person.ascentM.toLocaleString("sv-SE")} höjdmeter · {person.observations} observationer
        </p>
        {actions}
      </div>
    </div>
  );
}

/** How points are earned — shown on your own profile. */
export function XpExplainer() {
  return (
    <p className="form__hint level-card__rules">
      Du får {XP_RULES.perTour} poäng per tur du laddar upp, {XP_RULES.per100m} poäng per 100 höjdmeter och{" "}
      {XP_RULES.perObservation} poäng per observation du delar. Poängen räknar hur mycket du loggat och delat – inte
      hur brant eller riskabelt du åkt.
    </p>
  );
}
