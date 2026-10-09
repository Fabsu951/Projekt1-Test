import { PUBLIC_SITE_URL } from "../services/native";
import { canonicalPath, isIndexable, pageDescription } from "./pageHead";

// What search engines see for each page: a description, the one address
// that counts (snolage.se, also when the page was opened on
// fjallkoll.pages.dev or www.), and "noindex" for pages that are personal,
// need an account, or show other people's tours and profiles. The texts
// live in pageHead.ts, which the build also uses for each page's HTML.

export { isIndexable, pageDescription };

/** snolage.se + the path, without query or trailing slash. */
export function canonicalUrl(pathname: string): string {
  return `${PUBLIC_SITE_URL}${canonicalPath(pathname)}`;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Updates the description, canonical address and robots hint in <head>. */
export function applyPageMeta(pathname: string, title: string): void {
  const description = pageDescription(pathname);
  const url = canonicalUrl(pathname);
  setMeta("name", "description", description);
  setMeta("name", "robots", isIndexable(pathname) ? "index, follow" : "noindex, follow");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}
