import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// The apps' own background sender for "Dela position": ShareLocationService
// (Android, a foreground service with a "Stoppa" notification) and
// ShareLocationPlugin.swift (iPhone, background location updates). It keeps
// sending while Snöläge is in the background or the screen is off; in a
// browser the page sends only while it is open (LocationShareBridge).

export interface SentEvent {
  lat: number;
  lon: number;
  accuracy: number;
  at: string;
}

/** "ended": the end time passed; "stopped": "Stoppa" in the notification; "gone": stopped elsewhere or logged out. */
export interface StoppedEvent {
  reason: "ended" | "stopped" | "gone";
}

interface ShareLocationPlugin {
  start(options: { token: string; url: string; endsAt: number; text: string; stopText: string }): Promise<{ started: boolean; reason?: string }>;
  stop(): Promise<void>;
  status(): Promise<{ running: boolean }>;
  addListener(event: "sent", listener: (e: SentEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "stopped", listener: (e: StoppedEvent) => void): Promise<PluginListenerHandle>;
}

export const ShareLocation = registerPlugin<ShareLocationPlugin>("ShareLocation");

/** True in the Android and iPhone apps, where sharing keeps going in the background. */
export function backgroundSharing(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ShareLocation");
}

/** Stops the background sender if there is one (the share itself is deleted by the caller). */
export async function stopBackgroundSharing(): Promise<void> {
  if (!backgroundSharing()) return;
  try {
    await ShareLocation.stop();
  } catch {
    // Not running.
  }
}
