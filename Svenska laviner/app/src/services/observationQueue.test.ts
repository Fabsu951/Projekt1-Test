import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("./observationService", () => ({ createObservation: create }));

import { ApiError } from "./api";
import { flushObservationQueue, QUEUE_CHANGED_EVENT, queuedObservations, submitObservation } from "./observationQueue";

const obs = (extra: object = {}) => ({
  type: "sprickor",
  lat: 67.9,
  lon: 18.5,
  regionId: "kebnekaisefjallen",
  observedAt: new Date("2027-02-14T09:30:00Z"),
  description: "Snabbobservation: Skjutsprickor.",
  image: null,
  dangerSigns: ["skjutsprickor"],
  snowDepthCm: null,
  ...extra,
});
const offline = () => new ApiError(0, "Ingen kontakt med servern.");

describe("observations without coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    create.mockReset();
  });

  it("keeps an observation on the phone when there's no answer, and sends it later with the same id and time", async () => {
    create.mockRejectedValueOnce(offline());
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" });
    expect(await submitObservation("tok", 1, obs({ image }))).toEqual({ queued: true });
    const [waiting] = await queuedObservations(1);
    expect(waiting.observation.observedAt).toBe("2027-02-14T09:30:00.000Z");
    expect(waiting.observation.image).toMatch(/^data:image\/jpeg;base64,/);

    const sentEvents: number[] = [];
    window.addEventListener(QUEUE_CHANGED_EVENT, (e) => sentEvents.push((e as CustomEvent).detail.sent));
    create.mockResolvedValueOnce({});
    expect(await flushObservationQueue("tok", 1)).toBe(1);
    const sent = create.mock.calls[1][1];
    expect(sent.clientId).toBe(create.mock.calls[0][1].clientId);
    expect(sent.observedAt.toISOString()).toBe("2027-02-14T09:30:00.000Z");
    expect(new Uint8Array(await (sent.image as Blob).arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));
    expect(await queuedObservations(1)).toEqual([]);
    expect(sentEvents).toContain(1);
  });

  it("doesn't keep what the server refused, and only sends your own", async () => {
    create.mockRejectedValueOnce(new ApiError(400, "Beskriv vad du såg."));
    await expect(submitObservation("tok", 1, obs())).rejects.toThrow("Beskriv vad du såg.");
    expect(await queuedObservations(1)).toEqual([]);

    create.mockRejectedValue(offline());
    await submitObservation("tok", 2, obs());
    expect(await queuedObservations(1)).toEqual([]);
    expect(await queuedObservations(2)).toHaveLength(1);
  });

  it("waits while still offline or the server is busy, and marks refusals for the user", async () => {
    create.mockRejectedValue(offline());
    await submitObservation("tok", 1, obs());
    await submitObservation("tok", 1, obs({ description: "Snabbobservation: inga varningstecken." }));

    create.mockReset();
    create.mockRejectedValueOnce(new ApiError(503, "Upptagen"));
    expect(await flushObservationQueue("tok", 1)).toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await queuedObservations(1)).every((q) => !q.failed)).toBe(true);

    create.mockReset();
    create.mockRejectedValueOnce(new ApiError(400, "Observationen får vara högst 30 dagar gammal.")).mockResolvedValueOnce({});
    expect(await flushObservationQueue("tok", 1)).toBe(1);
    const [left] = await queuedObservations(1);
    expect(left.failed).toBe("Observationen får vara högst 30 dagar gammal.");
    create.mockReset();
    expect(await flushObservationQueue("tok", 1)).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
