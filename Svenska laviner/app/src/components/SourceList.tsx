import type { Source } from "../types/avalanche";

interface Props {
  sources: Source[];
}

export default function SourceList({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <p className="source-list">
      Källa:{" "}
      {sources.map((source, i) => (
        <span key={source.url}>
          {i > 0 && ", "}
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.label}
          </a>
        </span>
      ))}
    </p>
  );
}
