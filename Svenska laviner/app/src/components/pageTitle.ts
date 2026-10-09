import { createContext, useContext, useEffect } from "react";

// Each page's name in the browser tab ("Karta – Snöläge"). Layout sets a
// name from the address; pages that know something more specific (a region,
// a tour, a person) override it with usePageTitle.

export const PageTitleContext = createContext<(title: string | null) => void>(() => {});

export function usePageTitle(title: string | null | undefined) {
  const set = useContext(PageTitleContext);
  useEffect(() => {
    set(title ?? null);
    return () => set(null);
  }, [set, title]);
}

export { defaultTitle, fullTitle } from "./pageHead";
