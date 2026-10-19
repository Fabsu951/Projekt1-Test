// Checks "Dela position" end to end in the real Android app (an emulator,
// .github/workflows/android-e2e.yml): start a share, put the app in the
// background, move, and require that the native sender (ShareLocationService)
// keeps sending; then "Stoppa" in its notification must end the share. Fails
// with the app's log and a screenshot otherwise – the 1.0.5 bug (the service
// never started) would have stopped here, not reached the testers.
import { diagnose, findStopInNotification, moveTo, shell, signIn, sleep, startApp, tap } from "./emulator.mjs";

const SHOT = process.argv[2] ?? "check-share-fel.png";
const SERVER = "http://127.0.0.1:8787";

async function events() {
  const res = await fetch(`${SERVER}/test/events`);
  return (await res.json()).events;
}

/** Waits up to `ms` for an event matching `test`, moving the emulator a little every 10 s so new fixes arrive. */
async function waitFor(what, test, ms, walk) {
  const until = Date.now() + ms;
  let step = 0;
  while (Date.now() < until) {
    const found = (await events()).find(test);
    if (found) return found;
    if (walk) {
      step++;
      moveTo(67.905 + step * 0.0012, 18.556 + step * 0.0004);
    }
    await sleep(10_000);
  }
  throw new Error(`Timed out waiting for ${what}. Events: ${JSON.stringify(await events())}`);
}

const { device, app, go } = await startApp();
try {
  await signIn(app, go);

  // Start a two-hour share from the sharing page.
  await go("/dela-position");
  await sleep(3000);
  await (await app()).getByText("2 timmar", { exact: true }).click();
  await (await app()).getByRole("button", { name: "Börja dela" }).click();
  await waitFor("the share to start", (e) => e.type === "start", 20_000, false);
  console.log("✓ share started");

  // The native sender sends on its own while the app is open …
  await waitFor("a position from the native sender", (e) => e.type === "position" && e.from === "native", 120_000, true);
  console.log("✓ native sender sends");

  // … and keeps sending with the app in the background.
  shell("input keyevent KEYCODE_HOME");
  await sleep(1000);
  const left = Date.now();
  const bg = await waitFor(
    "a position sent in the background",
    (e) => e.type === "position" && e.from === "native" && e.at > left,
    200_000,
    true,
  );
  console.log(`✓ position sent ${Math.round((bg.at - left) / 1000)} s after the app went to the background`);

  // Its ongoing notification has "Stoppa", which ends the share on the server.
  const stop = await findStopInNotification();
  if (!stop) throw new Error("No “Stoppa” in Snöläge's notification");
  console.log("✓ notification with Stoppa");
  tap(stop);
  await waitFor("the share to be stopped from the notification", (e) => e.type === "stop" && e.from === "native", 20_000, false);
  console.log("✓ Stoppa ended the share");
  await sleep(2000);
  if (await findStopInNotification()) throw new Error("The notification is still there after Stoppa");
  console.log("✓ notification gone");
  shell("cmd statusbar collapse");
  console.log("Background sharing works.");
} catch (err) {
  console.log("FAILED:", err.message ?? err);
  diagnose(SHOT);
  process.exitCode = 1;
} finally {
  await Promise.race([device.close(), sleep(10_000)]);
  process.exit();
}
