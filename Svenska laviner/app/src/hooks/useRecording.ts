import { useEffect, useState } from "react";
import { readRecording, recordingStatus, RECORDING_CHANGED_EVENT, type RecordingStatus } from "../services/tourRecorder";
import { parseLines, type RecordingEntry } from "../utils/recording";

/**
 * The recording's state, and with `withTrack` also everything recorded so
 * far, read a little at a time (only new lines) every few seconds.
 */
export function useRecording(withTrack: boolean, everyMs = 3000) {
  const [status, setStatus] = useState<(RecordingStatus & { checkedAt: number }) | null>(null);
  const [entries, setEntries] = useState<RecordingEntry[]>([]);

  useEffect(() => {
    let live = true;
    let read = 0;
    let startedAt: number | null = null;
    let reading = false;
    let again = false;

    async function step() {
      const s = await recordingStatus();
      if (!live) return;
      if (startedAt !== s.startedAt) {
        // A new recording (or none): start over.
        startedAt = s.startedAt;
        read = 0;
        setEntries([]);
      }
      setStatus({ ...s, checkedAt: Date.now() });
      if (!withTrack || s.state === "idle") return;
      const { lines, total } = await readRecording(read);
      if (!live || total < read) return;
      read = total;
      if (lines.length) setEntries((old) => [...old, ...parseLines(lines)]);
    }

    // One read at a time, or two could fetch the same new lines; a call
    // while one runs is done right after it.
    async function run() {
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      try {
        do {
          again = false;
          await step().catch(() => {});
        } while (again && live);
      } finally {
        reading = false;
      }
    }

    void run();
    const onChange = () => void run();
    window.addEventListener(RECORDING_CHANGED_EVENT, onChange);
    const timer = window.setInterval(onChange, everyMs);
    return () => {
      live = false;
      window.removeEventListener(RECORDING_CHANGED_EVENT, onChange);
      window.clearInterval(timer);
    };
  }, [withTrack, everyMs]);

  return { status, entries };
}
