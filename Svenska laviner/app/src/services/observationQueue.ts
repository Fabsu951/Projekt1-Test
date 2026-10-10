import { Preferences } from "@capacitor/preferences";
import { ApiError } from "./api";
import { createObservation, type NewObservation } from "./observationService";

// Observations made without coverage. They are kept on the phone, with the
// time and place they were made, and sent when there is a connection again
// (ObservationQueueBridge tries at start, when the phone comes online or the
// app is reopened, and every minute while something waits). Each carries
// its own clientId, so a resend after a lost answer is not stored twice.

const KEY = "fjallkoll:observation-queue";
/** Fired whenever the queue changes; the detail says how many were just sent. */
export const QUEUE_CHANGED_EVENT = "fjallkoll:observation-queue-changed";
const MAX_QUEUED = 20;

interface StoredObservation extends Omit<NewObservation, "observedAt" | "image" | "clientId"> {
  observedAt: string;
  /** JPEG as a data: URL, already downscaled by prepareImage. */
  image: string | null;
}

export interface QueuedObservation {
  clientId: string;
  userId: number;
  savedAt: string;
  observation: StoredObservation;
  /** Set when the server refused it (e.g. too old); it then waits for the user. */
  failed?: string;
}

async function read(): Promise<QueuedObservation[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    const list = value ? JSON.parse(value) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function write(list: QueuedObservation[], sent = 0): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(list) });
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT, { detail: { sent } }));
}

/** This user's waiting observations, oldest first. */
export async function queuedObservations(userId: number): Promise<QueuedObservation[]> {
  return (await read()).filter((q) => q.userId === userId);
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** No answer at all from the server (no coverage), as opposed to a refusal. */
export function isConnectionError(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(url: string): Blob {
  const [head, data] = url.split(",", 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

export async function queueObservation(userId: number, obs: NewObservation & { clientId: string }): Promise<void> {
  const list = await read();
  if (list.filter((q) => q.userId === userId).length >= MAX_QUEUED) {
    throw new Error(`Det finns redan ${MAX_QUEUED} observationer som väntar på att skickas.`);
  }
  const { observedAt, image, clientId, ...rest } = obs;
  list.push({
    clientId,
    userId,
    savedAt: new Date().toISOString(),
    observation: { ...rest, observedAt: observedAt.toISOString(), image: image ? await blobToDataUrl(image) : null },
  });
  try {
    await write(list);
  } catch {
    throw new Error("Det finns inte plats att spara observationen på telefonen. Prova utan bild.");
  }
}

export async function removeQueued(clientId: string): Promise<void> {
  await write((await read()).filter((q) => q.clientId !== clientId));
}

/**
 * Sends a new observation, or keeps it on the phone when there's no
 * coverage. Refusals from the server (bad input, not verified …) are thrown
 * as before.
 */
export async function submitObservation(token: string, userId: number, obs: NewObservation): Promise<{ queued: boolean }> {
  const withId = { ...obs, clientId: obs.clientId ?? newClientId() };
  try {
    await createObservation(token, withId);
    return { queued: false };
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    await queueObservation(userId, withId);
    return { queued: true };
  }
}

let running: Promise<number> | null = null;

/**
 * Tries to send this user's waiting observations, oldest first. Stops at the
 * first sign of still being offline. Returns how many were sent.
 */
export function flushObservationQueue(token: string, userId: number): Promise<number> {
  running ??= (async () => {
    let sent = 0;
    try {
      for (const item of await queuedObservations(userId)) {
        if (item.failed) continue;
        const { observedAt, image, ...rest } = item.observation;
        try {
          await createObservation(token, {
            ...rest,
            observedAt: new Date(observedAt),
            image: image ? dataUrlToBlob(image) : null,
            clientId: item.clientId,
          });
          await write((await read()).filter((q) => q.clientId !== item.clientId), ++sent);
        } catch (err) {
          // No coverage yet, logged out, or the server is busy: try again later.
          if (isConnectionError(err)) break;
          const status = (err as ApiError).status;
          if (status === 401 || status === 429 || status >= 500) break;
          const message = err instanceof Error ? err.message : "Servern tog inte emot observationen.";
          await write((await read()).map((q) => (q.clientId === item.clientId ? { ...q, failed: message } : q)), sent);
        }
      }
    } finally {
      running = null;
    }
    return sent;
  })();
  return running;
}
