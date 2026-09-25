import type { ForecastProblem } from "../types/avalanche";
import { AspectRosette } from "./CompassIcons";
import ElevationIcon from "./ElevationIcon";
import { ELEVATION_LABELS } from "../data/elevations";
import ProblemIcon from "./ProblemIcon";

function elevationText(problem: ForecastProblem): string {
  const parts = [problem.elevations.map((e) => ELEVATION_LABELS[e]).join(", ")];
  if (problem.metersAbove !== null) parts.push(`över ${problem.metersAbove} m`);
  if (problem.metersBelow !== null) parts.push(`under ${problem.metersBelow} m`);
  return parts.filter(Boolean).join(", ");
}

interface Props {
  problems: ForecastProblem[];
}

/** Today's avalanche problems from the official forecast: where they are and how bad. */
export default function ForecastProblems({ problems }: Props) {
  return (
    <div className="forecast-problems">
      {problems.map((problem, i) => (
        <article key={`${problem.name}-${i}`} className="forecast-problem">
          <header className="forecast-problem__header">
            {problem.type && <ProblemIcon problem={problem.type} size={44} />}
            <h3>{problem.name}</h3>
          </header>

          <div className="forecast-problem__where">
            <figure>
              <AspectRosette highlighted={problem.aspects} />
              <figcaption>{problem.aspects.length === 8 ? "Alla väderstreck" : problem.aspects.join(", ")}</figcaption>
            </figure>
            <figure>
              <ElevationIcon highlighted={problem.elevations} />
              <figcaption>{elevationText(problem)}</figcaption>
            </figure>
          </div>

          <dl className="forecast-problem__facts">
            {problem.sensitivity && (
              <>
                <dt>Känslighet och utbredning</dt>
                <dd>{problem.sensitivity}</dd>
              </>
            )}
            {problem.size && (
              <>
                <dt>Största förväntade storlek</dt>
                <dd>{problem.size}</dd>
              </>
            )}
            {problem.where && (
              <>
                <dt>Här finns lavinproblemet</dt>
                <dd>{problem.where}</dd>
              </>
            )}
          </dl>

          {problem.infoUrl && (
            <a className="forecast-problem__more" href={problem.infoUrl} target="_blank" rel="noreferrer">
              Mer om {problem.name.toLowerCase()} på lavinprognoser.se →
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
