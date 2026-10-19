// Drives the real Android app in an emulator and records the screen, for
// Google Play's "foreground service permissions" declaration: start sharing
// your position, see it on a friend's map, put the app in the background,
// the ongoing notification with "Stoppa", stop it. Run by
// .github/workflows/play-video.yml with server.mjs answering as the worker.
import { spawn, execFileSync } from "node:child_process";
import { _android as android } from "playwright";

const OUT = process.argv[2] ?? "dela-position.mp4";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...args) => execFileSync("adb", args, { encoding: "utf8" });
const shell = (cmd) => adb("shell", cmd);

/** The centre of the first on-screen element whose text matches, from uiautomator. */
function find(pattern) {
  shell("uiautomator dump /sdcard/ui.xml");
  const xml = shell("cat /sdcard/ui.xml");
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
const tap = ({ x, y }) => shell(`input tap ${x} ${y}`);

const pkg = "se.snolage.app";
for (const p of ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]) {
  try {
    shell(`pm grant ${pkg} android.permission.${p}`);
  } catch {
    // Older Android: no runtime notification permission.
  }
}
adb("emu", "geo", "fix", "18.552", "67.902");
shell(`am start -n ${pkg}/.MainActivity`);

const [device] = await android.devices();
const webview = await device.webView({ pkg }, { timeout: 120_000 });
const page = await webview.page();
await page.waitForLoadState();
await page.evaluate(() => {
  localStorage.setItem("fjallkoll:language", "sv");
  localStorage.setItem("fjallkoll:welcome-done", "1");
  localStorage.setItem("fjallkoll:theme", "light");
});

// Log in (the demo server accepts anything) before the recording starts.
await page.evaluate(() => (location.href = "/logga-in"));
await page.locator('input[type="email"]').fill("demo@example.se");
await page.locator('input[type="password"]').fill("demo-demo-demo");
await page.locator('form button[type="submit"]').click();
await sleep(3000);
await page.evaluate(() => (location.href = "/"));
await sleep(4000);

const recorder = spawn("adb", ["shell", "screenrecord", "--bit-rate", "6000000", "--time-limit", "170", "/sdcard/demo.mp4"]);
await sleep(1500);

// 1. The start page and its "Dela position" button.
await sleep(2500);
await page.getByRole("link", { name: "Dela position" }).first().click();
await sleep(3000);

// 2. Pick who sees it and for how long, then start.
await page.getByText("2 timmar", { exact: true }).click();
await sleep(1200);
await page.getByRole("button", { name: "Börja dela" }).click();
await sleep(1500);
adb("emu", "geo", "fix", "18.553", "67.9025");
await sleep(3500);

// 3. A friend sharing with you, on the map.
await page.getByRole("link", { name: "Visa på kartan" }).click();
await sleep(5000);

// 4. Into the background: sharing goes on, with an ongoing notification.
shell("input keyevent KEYCODE_HOME");
await sleep(2500);
adb("emu", "geo", "fix", "18.556", "67.9031");
shell("cmd statusbar expand-notifications");
await sleep(2500);
let stop = find(/^Stoppa$/i);
if (!stop) {
  const expand = find(/expand_button/);
  if (expand) tap(expand);
  await sleep(1500);
  stop = find(/^Stoppa$/i);
}
await sleep(3000);

// 5. "Stoppa" in the notification ends it and deletes the position.
if (stop) tap(stop);
else console.log("Found no Stoppa button in the notification");
await sleep(3000);
shell("cmd statusbar collapse");
shell(`am start -n ${pkg}/.MainActivity`);
await sleep(2000);
await page.evaluate(() => (location.href = "/dela-position"));
await sleep(4000);

shell("pkill -INT screenrecord");
await new Promise((r) => recorder.on("exit", r));
await sleep(1500);
adb("pull", "/sdcard/demo.mp4", OUT);
await device.close();
console.log(`Saved ${OUT}`);
