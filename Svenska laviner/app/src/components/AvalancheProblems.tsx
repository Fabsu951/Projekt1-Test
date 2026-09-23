import type { AvalancheProblem } from "../types/avalanche";
import { PROBLEM_LABELS, PROBLEM_SOURCES } from "../data/avalancheProblems";
import SourceList from "./SourceList";
import ProblemIcon from "./ProblemIcon";

interface Props {
  problems: AvalancheProblem[];
}

export default function AvalancheProblems({ problems }: Props) {
  if (problems.length === 0) return null;

  return (
    <div className="avalanche-problems">
      {problems.map((problem) => {
        const info = PROBLEM_LABELS[problem];
        return (
          <div key={problem} className="avalanche-problems__item">
            <ProblemIcon problem={problem} />
            <div>
              <strong>{info.label}</strong>
              <p>{info.description}</p>
            </div>
          </div>
        );
      })}
      <SourceList sources={PROBLEM_SOURCES} />
    </div>
  );
}
