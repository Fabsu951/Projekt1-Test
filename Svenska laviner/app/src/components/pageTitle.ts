import { createContext, useContext, useEffect } from "react";

// Each page's name in the browser tab ("Karta – Turkoll"). Layout sets a
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

const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, "Områden"],
  [/^\/omrade\//, "Område"],
  [/^\/karta/, "Karta"],
  [/^\/observationer\/ny/, "Ny observation"],
  [/^\/observationer/, "Observationer"],
  [/^\/turer\/ny/, "Ny tur"],
  [/^\/turer\/\d/, "Tur"],
  [/^\/turer/, "Turer"],
  [/^\/flode/, "Flöde"],
  [/^\/notiser/, "Notiser"],
  [/^\/person\//, "Person"],
  [/^\/sakerhetsguide/, "Säkerhetsguide"],
  [/^\/om-appen/, "Om Turkoll"],
  [/^\/offline/, "Utan täckning"],
  [/^\/logga-in/, "Logga in"],
  [/^\/registrera/, "Skapa konto"],
  [/^\/profil/, "Min profil"],
  [/^\/admin/, "Anmälda inlägg"],
  [/^\/glomt-losenord/, "Glömt lösenord"],
  [/^\/aterstall-losenord/, "Nytt lösenord"],
  [/^\/verifiera/, "Bekräfta e-post"],
];

export function defaultTitle(pathname: string): string | null {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? null;
}

export function fullTitle(title: string | null): string {
  return title ? `${title} – Turkoll` : "Turkoll";
}
