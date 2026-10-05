import { Capacitor } from "@capacitor/core";

// Things that work differently inside the Android/iOS apps than on the web.

/** The public site. In the apps the page's own origin is https://localhost, which is useless in a shared link. */
export const PUBLIC_SITE_URL = (
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? "https://fjallkoll.pages.dev"
).replace(/\/$/, "");

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** A link others can open: the public site in the apps, this site's address on the web. */
export function shareableUrl(path: string): string {
  const base = isNativeApp() ? PUBLIC_SITE_URL : window.location.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Saves a text file for the user. On the web it downloads; in the apps
 * (where downloads don't work in the web view) it writes the file to the
 * app's cache and opens the phone's share sheet, so it can go to a watch
 * app, Files, mail and so on.
 */
export async function saveTextFile(fileName: string, text: string, mimeType: string): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: fileName, files: [written.uri], dialogTitle: "Spara eller skicka filen" });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * App start-up: Android's back button/gesture goes back a page inside the
 * app, and only closes it from the first page.
 */
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
