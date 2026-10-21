// Driving the real Android app in an emulator, shared by drive.mjs (Play's
// demo video) and check-share.mjs (the background-sharing test). Expects the
// demo APK installed and server.mjs answering as the worker on 10.0.2.2:8787.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { _android as android } from "playwright";

export const pkg = "se.snolage.app";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const adb = (...args) => execFileSync("adb", args, { encoding: "utf8", timeout: 60_000 });
export const shell = (cmd) => adb("shell", cmd);

/** The screen's element tree from uiautomator, or "" if it can't be read right now. */
function screenXml() {
  // A dump now and then fails while the screen changes (no ui.xml then): try again once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      shell("uiautomator dump /sdcard/ui.xml");
      return shell("cat /sdcard/ui.xml");
    } catch {
      execFileSync("sleep", ["1"]);
    }
  }
  return "";
}

/** The centre of the first on-screen element whose text matches, from uiautomator. */
export function find(pattern) {
  const xml = screenXml();
  for (const node of xml.split("<node ")) {
    const text = node.match(/ text="([^"]*)"/)?.[1] ?? "";
    const desc = node.match(/content-desc="([^"]*)"/)?.[1] ?? "";
    const id = node.match(/resource-id="([^"]*)"/)?.[1] ?? "";
    if (pattern.test(text) || pattern.test(desc) || pattern.test(id)) {
      const b = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (b) return { x: (Number(b[1]) + Number(b[3])) >> 1, y: (Number(b[2]) + Number(b[4])) >> 1 };
    }
  }
  return null;
}
export const tap = ({ x, y }) => shell(`input tap ${x} ${y}`);

/** Emulator position; adb takes longitude first. */
export const moveTo = (lat, lon) => adb("emu", "geo", "fix", String(lon), String(lat));

/**
 * Settles the freshly booted system, gives the app its permissions, starts it
 * and connects to its WebView. Returns `app()` (the app's page, looked up
 * again each time since a reload or restart can replace the WebView target),
 * `go(path)` and the Playwright device.
 */
export async function startApp() {
  shell("settings put secure user_setup_complete 1");
  // The slow emulator's launcher sometimes "isn't responding"; keep that dialog away.
  shell("settings put global hide_error_dialogs 1");
  await sleep(20_000);
  for (const p of ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]) {
    try {
      shell(`pm grant ${pkg} android.permission.${p}`);
    } catch {
      // Older Android: no runtime notification permission.
    }
  }
  moveTo(67.902, 18.552);
  shell(`am start -n ${pkg}/.MainActivity`);

  const [device] = await android.devices();
  await device.webView({ pkg }, { timeout: 120_000 });

  async function app() {
    for (let i = 0; i < 30; i++) {
      for (const w of device.webViews()) {
        if (w.pkg() !== pkg) continue;
        try {
          const page = await w.page();
          if (!page.isClosed()) return page;
        } catch {
          // Target went away; try the next one.
        }
      }
      await sleep(1000);
    }
    throw new Error("The app's WebView is gone");
  }

  /** In-app navigation (React Router listens to popstate), so the WebView never reloads. */
  async function go(path) {
    await (await app()).evaluate((p) => {
      history.pushState({}, "", p);
      dispatchEvent(new PopStateEvent("popstate"));
    }, path);
  }

  return { device, app, go };
}

/** Swedish, light theme, no welcome guide, signed in (the demo server accepts anything). */
export async function signIn(app, go) {
  const page = await app();
  await page.waitForLoadState();
  await page.evaluate(() => {
    localStorage.setItem("fjallkoll:language", "sv");
    localStorage.setItem("fjallkoll:welcome-done", "1");
    localStorage.setItem("fjallkoll:theme", "light");
  });
  // Language and theme are read at start-up (the emulator itself is in English).
  await page.reload();
  await sleep(4000);
  await go("/logga-in");
  const form = await app();
  await form.locator('input[type="email"]').fill("demo@example.se");
  await form.locator('input[type="password"]').fill("demo-demo-demo");
  await form.locator('form button[type="submit"]').click();
  await sleep(3000);
  const wait = find(/^Wait$/);
  if (wait) {
    tap(wait);
    await sleep(1500);
  }
}

/** Opens the notification shade and finds Snöläge's "Stoppa", expanding the notification if needed. */
export async function findStopInNotification() {
  shell("cmd statusbar expand-notifications");
  await sleep(2500);
  let stop = find(/^Stoppa$/i);
  if (!stop) {
    const expand = find(/expand_button/);
    if (expand) tap(expand);
    await sleep(1500);
    stop = find(/^Stoppa$/i);
  }
  return stop;
}

/** On failure: what the app logged, and what the screen showed (saved as `screenshot`). */
export function diagnose(screenshot) {
  try {
    const log = adb("logcat", "-d", "-t", "800");
    console.log(log.split("\n").filter((l) => /AndroidRuntime|FATAL|chromium|Capacitor|Console|snolage|ShareLocation/i.test(l)).slice(-200).join("\n"));
  } catch (e) {
    console.log("No logcat:", e.message);
  }
  try {
    writeFileSync(screenshot, execFileSync("adb", ["exec-out", "screencap", "-p"], { timeout: 30_000 }));
  } catch {
    // Only a help.
  }
}
