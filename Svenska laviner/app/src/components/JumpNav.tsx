import { useEffect, useState } from "react";
import { t } from "../i18n";

export interface JumpTarget {
  /** The section's id on the page. */
  id: string;
  label: string;
}

/** Asks a folded section with this anchor to open (see CollapsibleSection). */
export const OPEN_SECTION_EVENT = "snolage:open-section";

/**
 * A row of links that stays under the header and jumps to the page's main
 * sections, marking the one you are reading. Long pages stop being a scroll.
 */
export default function JumpNav({ targets }: { targets: JumpTarget[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  const ids = targets.map((x) => x.id).join(",");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = ids.split(",").find((id) => seen.get(id));
        if (first) setCurrent(first);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    for (const id of ids.split(",")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  const jump = (id: string) => {
    window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: id }));
    // Let a folded section open before measuring where it is.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    setCurrent(id);
    history.replaceState(history.state, "", `#${id}`);
  };

  return (
    <nav className="jump-nav" aria-label={t("Hoppa till")}>
      <ul>
        {targets.map((target) => (
          <li key={target.id}>
            <a
              href={`#${target.id}`}
              aria-current={current === target.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                jump(target.id);
              }}
            >
              {target.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
