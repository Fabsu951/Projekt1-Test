import type { AvalancheProblem } from "../types/avalanche";
import { PROBLEM_LABELS } from "../data/avalancheProblems";

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
            <strong>{info.label}</strong>
            <p>{info.description}</p>
          </div>
        );
      })}
    </div>
  );
}
