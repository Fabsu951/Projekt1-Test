import { describe, expect, it } from "vitest";
import { REGIONS } from "../data/regions";
import { applyPageMeta, canonicalUrl, isIndexable, pageDescription } from "./pageMeta";
import sitemap from "../../public/sitemap.xml?raw";

describe("page meta for search engines", () => {
  it("describes area pages by name, and falls back to the site's own text", () => {
    expect(pageDescription("/omrade/kebnekaisefjallen")).toContain("Dagens lavinprognos för Kebnekaisefjällen");
    expect(pageDescription("/omrade/kebnekaisefjallen/sasong")).toContain("Säsongen dag för dag i Kebnekaisefjällen");
    expect(pageDescription("/finns-inte")).toBe(pageDescription("/"));
  });

  it("indexes public pages only, never accounts, people or tours", () => {
    for (const path of ["/", "/karta", "/observationer", "/turer", "/sakerhetsguide", "/omrade/kebnekaisefjallen"]) {
      expect(isIndexable(path)).toBe(true);
    }
    for (const path of ["/profil", "/admin", "/flode", "/person/3", "/turer/12", "/turer/ny", "/logga-in", "/omrade/okant", "/x"]) {
      expect(isIndexable(path)).toBe(false);
    }
  });

  it("always points at snolage.se, without query or trailing slash", () => {
    expect(canonicalUrl("/karta/")).toBe("https://snolage.se/karta");
    expect(canonicalUrl("/")).toBe("https://snolage.se/");
  });

  it("writes description, robots, Open Graph and canonical into <head>", () => {
    applyPageMeta("/profil", "Min profil – Snöläge");
    applyPageMeta("/karta", "Karta – Snöläge");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe("Karta – Snöläge");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://snolage.se/karta");
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it("lists every public page and area in the sitemap", () => {
    const urls = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map((m) => m[1]);
    for (const r of REGIONS) {
      expect(urls).toContain(`https://snolage.se/omrade/${r.id}`);
      expect(urls).toContain(`https://snolage.se/omrade/${r.id}/sasong`);
    }
    for (const url of urls) expect(isIndexable(new URL(url).pathname)).toBe(true);
  });
});
