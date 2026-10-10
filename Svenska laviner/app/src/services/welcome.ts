// Whether this device has seen the welcome guide (components/WelcomeGuide.tsx).

const DONE_KEY = "fjallkoll:welcome-done";

/** Whether this device has been through (or skipped) the welcome guide. */
export function welcomeDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomeDone() {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // Not remembered: the guide shows again next time, nothing worse.
  }
}
