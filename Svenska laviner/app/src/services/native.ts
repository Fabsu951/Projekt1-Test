import { Capacitor } from "@capacitor/core";
import { t } from "../i18n";

// Things that work differently inside the Android/iOS apps than on the web.

/** The public site. In the apps the page's own origin is https://localhost, which is useless in a shared link. */
export const PUBLIC_SITE_URL = (
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? "https://snolage.se"
).replace(/\/$/, "");

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** A link others can open: the public site in the apps, this site's address on the web. */
export function shareableUrl(path: string): string {
  const base = isNativeApp() ? PUBLIC_SITE_URL : window.location.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Shares a link to a page in the app: the phone's share sheet in the apps
 * and in browsers that have one, otherwise the link is copied.
 */
export async function sharePage(path: string, title: string, text: string): Promise<ShareOutcome> {
  const url = shareableUrl(path);
  try {
    if (isNativeApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: t("Dela") });
      return "shared";
    }
    if (typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (err) {
    // Closing the share sheet counts as an error in both APIs.
    const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
    return /abort|cancel/i.test(message) ? "cancelled" : "failed";
  }
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
    await Share.share({ title: fileName, files: [written.uri], dialogTitle: t("Spara eller skicka filen") });
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
 * Whether Android laid the page out between the status bar and the navigation
 * bar itself: then the page is clearly shorter than the screen. Edge-to-edge
 * pages fill the screen and pad for the bars themselves (index.css --safe-*).
 */
export function insetsFromSystem(screenHeight: number, pageHeight: number): boolean {
  return screenHeight - pageHeight > 20;
}

function markAndroidInsets() {
  const root = document.documentElement;
  root.dataset.native = "android";
  // Measured with the keyboard closed (start, turning the phone), since an
  // open keyboard also makes the page shorter.
  const measure = () => {
    if (insetsFromSystem(window.screen.height, window.innerHeight)) root.dataset.insets = "system";
    else delete root.dataset.insets;
  };
  measure();
  window.addEventListener("orientationchange", () => setTimeout(measure, 300));
}

/**
 * App start-up: Android's back button/gesture goes back a page inside the
 * app, and only closes it from the first page.
 */
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  if (Capacitor.getPlatform() === "android") markAndroidInsets();
  // Shows in Xcode's console and in the iPhone check on GitHub (ios.yml):
  // "Karta offline" needs Cache Storage in the app's web view.
  console.info(`[Snöläge] start ${Capacitor.getPlatform()}, offline-kartor: ${"caches" in window ? "ja" : "nej"}`);
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
