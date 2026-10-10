import { levelAdvice } from "../data/dangerAdvice";
import { getDangerInfo } from "../data/dangerScale";
import { t } from "../i18n";

interface Props {
  level: number;
}

/** "What does this mean for me?": a few plain lines for today's published level. */
export default function DangerAdvice({ level }: Props) {
  const advice = levelAdvice(level);
  if (advice.length === 0) return null;
  return (
    <section className="danger-advice" aria-labelledby="danger-advice-title" style={{ ["--lvl" as string]: getDangerInfo(level).color }}>
      <h2 id="danger-advice-title">{t("Vad betyder det för mig?")}</h2>
      <ul>
        {advice.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="danger-advice__note">
        {t("Allmänna råd för {level}. De ersätter inte prognosen eller din egen bedömning på plats.", {
          level: getDangerInfo(level).label.toLowerCase(),
        })}
      </p>
    </section>
  );
}
