import type { ForecastProblem } from "../types/avalanche";
import { AspectRosette } from "./CompassIcons";
import ElevationIcon from "./ElevationIcon";
import { ELEVATION_LABELS } from "../data/elevations";
import ProblemIcon from "./ProblemIcon";
import { PROBLEM_LABELS } from "../data/avalancheProblems";
import { PROBLEM_ADVICE } from "../data/dangerAdvice";
import { t, compass } from "../i18n";
import Icon from "./Icon";

function elevationText(problem: ForecastProblem): string {
  const parts = [problem.elevations.map((e) => ELEVATION_LABELS[e]).join(", ")];
  if (problem.metersAbove !== null) parts.push(t("över {m} m", { m: problem.metersAbove }));
  if (problem.metersBelow !== null) parts.push(t("under {m} m", { m: problem.metersBelow }));
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
              <figcaption>{problem.aspects.length === 8 ? t("Alla väderstreck") : problem.aspects.map(compass).join(", ")}</figcaption>
            </figure>
            <figure>
              <ElevationIcon highlighted={problem.elevations} />
              <figcaption>{elevationText(problem)}</figcaption>
            </figure>
          </div>

          <dl className="forecast-problem__facts">
            {problem.sensitivity && (
              <>
                <dt>{t("Känslighet och utbredning")}</dt>
                <dd>{problem.sensitivity}</dd>
              </>
            )}
            {problem.size && (
              <>
                <dt>{t("Största förväntade storlek")}</dt>
                <dd>{problem.size}</dd>
              </>
            )}
            {problem.where && (
              <>
                <dt>{t("Här finns lavinproblemet")}</dt>
                <dd>{problem.where}</dd>
              </>
            )}
          </dl>

          {problem.type && (
            <details className="forecast-problem__explain">
              <summary>{t("Vad är {name}?", { name: problem.name.toLowerCase() })}</summary>
              <p>{PROBLEM_LABELS[problem.type].description}</p>
              <p>
                <strong>{t("Så hanterar du det:")}</strong>{" "}
                {PROBLEM_ADVICE[problem.type]}
              </p>
            </details>
          )}

          {problem.infoUrl && (
            <a className="forecast-problem__more" href={problem.infoUrl} target="_blank" rel="noreferrer">
              {t("Mer om")}{" "}{problem.name.toLowerCase()}{" "}{t("på lavinprognoser.se")}<Icon name="arrowRight" size={16} className="icon--link" />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
