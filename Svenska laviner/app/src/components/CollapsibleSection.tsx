import { useId, useState, type ReactNode } from "react";

const storageKey = (id: string) => `fjallkoll:section-open:${id}`;

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(storageKey(id));
    return saved === null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

/**
 * A page section whose content folds away behind its heading, with the
 * number of items shown beside it. Open/closed is remembered per section
 * on the device.
 */
export default function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  /** Stable name used to remember the state, e.g. "profile-tours". */
  id: string;
  title: string;
  /** Shown beside the title once known. */
  count?: number | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const bodyId = useId();

  const toggle = () =>
    setOpen((was) => {
      try {
        localStorage.setItem(storageKey(id), was ? "0" : "1");
      } catch {
        // Not remembered; the section still opens and closes.
      }
      return !was;
    });

  return (
    <section className="section collapsible">
      <h2 className="collapsible__heading">
        <button type="button" className="collapsible__toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          {title}
          {count !== null && count !== undefined && <span className="collapsible__count">{count}</span>}
          <span className={open ? "map-toolbar__chevron map-toolbar__chevron--open" : "map-toolbar__chevron"} aria-hidden="true" />
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/** Shows the first `initial` items, with a button for the rest. */
export function ShowMore<T>({
  items,
  initial = 5,
  render,
}: {
  items: T[];
  initial?: number;
  render: (visible: T[]) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const visible = all ? items : items.slice(0, initial);
  return (
    <>
      {render(visible)}
      {items.length > initial && (
        <button type="button" className="button collapsible__more" onClick={() => setAll((a) => !a)}>
          {all ? "Visa färre" : `Visa alla ${items.length}`}
        </button>
      )}
    </>
  );
}
