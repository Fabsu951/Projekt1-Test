import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import sitemap from "../../public/sitemap.xml?raw";
import { pageHead, staticTitle, withPageHead } from "./pageHead";

describe("page heads written at build time", () => {
  it("names area and season pages after the area", () => {
    expect(staticTitle("/omrade/riksgransfjallen")).toBe("Riksgränsfjällen – Snöläge");
    expect(staticTitle("/omrade/riksgransfjallen/sasong")).toBe("Säsongen – Riksgränsfjällen – Snöläge");
    expect(staticTitle("/karta")).toBe("Karta – Snöläge");
    expect(staticTitle("/omrade/okant")).toBe("Område – Snöläge");
  });

  it("fills title, description, canonical and Open Graph for every page in the sitemap", () => {
    const paths = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const path of paths) {
      const head = pageHead(path, "https://snolage.se");
      const html = withPageHead(indexHtml, head);
      const doc = new DOMParser().parseFromString(html, "text/html");
      expect(doc.title).toBe(head.title);
      expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(head.description);
      expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(head.url);
      expect(doc.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(head.url);
      expect(doc.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(head.title);
      expect(doc.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(head.description);
      // The app starts exactly as from index.html.
      expect(html.slice(html.indexOf("</head>"))).toBe(indexHtml.slice(indexHtml.indexOf("</head>")));
    }
  });

  it("escapes text and refuses an index.html without the tags", () => {
    const html = withPageHead(indexHtml, { title: 'A & "B"', description: "<x>", url: "https://snolage.se/a" });
    expect(html).toContain("<title>A &amp; &quot;B&quot;</title>");
    expect(html).toContain('content="&lt;x&gt;"');
    expect(() => withPageHead("<html><head><title>x</title></head></html>", pageHead("/karta", "https://snolage.se"))).toThrow();
  });
});
