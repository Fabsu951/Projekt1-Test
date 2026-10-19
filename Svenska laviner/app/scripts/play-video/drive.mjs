// Drives the real Android app in an emulator and records the screen, for
// Google Play's "foreground service permissions" declaration: start sharing
// your position, put the app in the background, the ongoing notification
// with "Stoppa", stop it. Run by .github/workflows/play-video.yml with
// server.mjs answering as the worker.
import { spawn } from "node:child_process";
import { adb, diagnose, find, findStopInNotification, moveTo, pkg, shell, signIn, sleep, startApp, tap } from "./emulator.mjs";

const OUT = process.argv[2] ?? "dela-position.mp4";
const { device, app, go } = await startApp();

let recorder = null;
try {
  await run();
} catch (err) {
  console.log("Failed:", err);
  diagnose(OUT.replace(/\.mp4$/, "-fel.png"));
  process.exitCode = 1;
} finally {
  if (recorder) {
    try {
      if (recorder.exitCode === null) shell("pkill -INT screenrecord");
      await Promise.race([new Promise((r) => recorder.on("exit", r)), sleep(15_000)]);
      await sleep(1500);
      adb("pull", "/sdcard/demo.mp4", OUT);
      console.log(`Saved ${OUT}`);
    } catch (err) {
      console.log("No video:", err.message);
      process.exitCode = 1;
    }
  }
  await Promise.race([device.close(), sleep(10_000)]);
  process.exit();
}

async function run() {
  await signIn(app, go);
  await go("/");
  await sleep(4000);

  const wait = find(/^Wait$/);
  if (wait) {
    tap(wait);
    await sleep(1500);
  }
  recorder = spawn("adb", ["shell", "screenrecord", "--bit-rate", "6000000", "--time-limit", "170", "/sdcard/demo.mp4"]);
  await sleep(1500);

  // 1. The start page and its "Dela position" button.
  await sleep(2500);
  await (await app()).getByRole("link", { name: "Dela position" }).first().click();
  await sleep(3000);

  // 2. Pick who sees it and for how long, then start.
  await (await app()).getByText("2 timmar", { exact: true }).click();
  await sleep(1200);
  await (await app()).getByRole("button", { name: "Börja dela" }).click();
  await sleep(1500);
  moveTo(67.9025, 18.553);
  await sleep(3500);

  // 3. The page shows the running share and who shares with you. (No map: drawing
  // it in the emulator's software graphics crashed the emulator now and then.)
  await (await app()).evaluate(() => window.scrollBy({ top: 900, behavior: "smooth" }));
  await sleep(3000);

  // 4. Into the background: sharing goes on, with an ongoing notification.
  shell("input keyevent KEYCODE_HOME");
  await sleep(2500);
  moveTo(67.9031, 18.556);
  const stop = await findStopInNotification();
  await sleep(3000);

  // 5. "Stoppa" in the notification ends it and deletes the position.
  // Without Snöläge's own notification the video shows nothing Play asks for: fail instead.
  if (!stop) throw new Error("Found no Stoppa button in the notification – is ShareLocationService running?");
  tap(stop);
  await sleep(3000);
  shell("cmd statusbar collapse");
  await sleep(800);
  shell("input keyevent KEYCODE_BACK");
  shell(`am start -n ${pkg}/.MainActivity`);
  await sleep(2500);
  await go("/dela-position");
  await sleep(6000);
}
