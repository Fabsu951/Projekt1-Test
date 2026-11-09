// Drives the real Android app in an emulator and records the screen, for
// Google Play's "foreground service permissions" declaration (location):
// "Spela in tur" – the user starts recording their own tour, the app goes to
// the background, the ongoing notification keeps recording (with Pause /
// Resume), and the user finishes and saves the tour. Run by
// .github/workflows/play-video.yml with server.mjs answering as the worker.
import { spawn } from "node:child_process";
import { adb, diagnose, find, moveTo, pkg, shell, signIn, sleep, startApp, tap } from "./emulator.mjs";

const OUT = process.argv[2] ?? "spela-in-tur.mp4";
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

/** A short walk north-east from the start, a fix every few seconds (the recorder takes one per 3 s / 5 m). */
let step = 0;
async function walk(n) {
  for (let i = 0; i < n; i++) {
    step++;
    moveTo(67.902 + step * 0.00018, 18.552 + step * 0.0001);
    await sleep(3500);
  }
}

/** Opens the notification shade and finds the recorder's action button. */
async function findInNotification(pattern) {
  shell("cmd statusbar expand-notifications");
  await sleep(2500);
  let button = find(pattern);
  if (!button) {
    const expand = find(/expand_button/);
    if (expand) tap(expand);
    await sleep(1500);
    button = find(pattern);
  }
  return button;
}

async function run() {
  await signIn(app, go);
  await go("/turer");
  await sleep(4000);

  const wait = find(/^Wait$/);
  if (wait) {
    tap(wait);
    await sleep(1500);
  }
  recorder = spawn("adb", ["shell", "screenrecord", "--bit-rate", "6000000", "--time-limit", "175", "/sdcard/demo.mp4"]);
  await sleep(1500);

  // 1. The Tours page and its "Spela in tur" button; the user starts recording.
  await sleep(2000);
  await (await app()).getByRole("link", { name: "Spela in tur" }).first().click();
  await sleep(3500);
  await (await app()).getByRole("button", { name: "Starta inspelningen" }).click();
  await sleep(2000);
  await walk(5);

  // 2. Into the background: the recording goes on, shown by an ongoing notification.
  shell("input keyevent KEYCODE_HOME");
  await sleep(2000);
  await walk(3);
  const pause = await findInNotification(/^(Pause|Pausa)$/i);
  // Without the recorder's own notification the video shows nothing Play asks for: fail instead.
  if (!pause) throw new Error("Found no Pause button in the notification – is TourRecorderService running?");
  await sleep(3000);

  // 3. Pause and resume from the notification.
  tap(pause);
  await sleep(3000);
  const resume = find(/^(Resume|Fortsätt)$/i);
  if (resume) {
    tap(resume);
    await sleep(3000);
  }
  shell("cmd statusbar collapse");
  await sleep(800);
  await walk(3);

  // 4. Back in the app: the track so far, then finish and save the tour.
  shell(`am start -n ${pkg}/.MainActivity`);
  await sleep(2500);
  await go("/turer/spela-in");
  await sleep(5000);
  await (await app()).getByRole("button", { name: "Avsluta" }).click();
  await sleep(1500);
  await (await app()).getByRole("button", { name: "Ja, avsluta" }).click();
  await sleep(5000);
  await (await app()).evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
  await sleep(2500);
  await (await app()).getByRole("button", { name: "Spara tur" }).click();
  await sleep(6000);
}
