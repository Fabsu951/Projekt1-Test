import { describe, expect, it } from "vitest";
// Garmin's SDK is only used here, to check our reader against theirs (it may
// not ship inside the app).
import { Decoder, Encoder, Profile, Stream } from "@garmin/fitsdk";
import { FitError, isFit, readFitRecords } from "./fitDecoder";

type Mesg = Parameters<Encoder["onMesg"]>[1];
const mesg = (m: Record<string, unknown>) => m as unknown as Mesg;
const toSemi = (deg: number) => Math.round((deg * 2 ** 31) / 180);
const FIT_EPOCH_S = Date.UTC(1989, 11, 31) / 1000;

function garminFile(): ArrayBuffer {
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, mesg({ type: "activity", manufacturer: "garmin", timeCreated: new Date(Date.UTC(2027, 2, 10, 8)) }));
  encoder.onMesg(Profile.MesgNum.EVENT, mesg({ timestamp: new Date(Date.UTC(2027, 2, 10, 8)), event: "timer", eventType: "start" }));
  for (let i = 0; i < 40; i++) {
    const r: Record<string, unknown> = { timestamp: new Date(Date.UTC(2027, 2, 10, 8, 0, i * 7)), heartRate: 120 + i };
    if (i % 9 !== 4) {
      r.positionLat = toSemi(67.85 + i * 0.0011);
      r.positionLong = toSemi(18.6 - i * 0.0007);
    }
    if (i % 2) r.enhancedAltitude = 700 + i * 3.2;
    else r.altitude = 700 + i * 3.2;
    encoder.onMesg(Profile.MesgNum.RECORD, mesg(r));
  }
  const bytes = encoder.close();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Hand-built FIT bytes for the cases Garmin's encoder never writes. */
class Builder {
  bytes: number[] = [];
  u8(...v: number[]) {
    this.bytes.push(...v);
    return this;
  }
  u16(v: number, le = true) {
    return le ? this.u8(v & 0xff, v >> 8) : this.u8(v >> 8, v & 0xff);
  }
  u32(v: number, le = true) {
    const b = [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, v >>> 24];
    return this.u8(...(le ? b : b.reverse()));
  }
  i32(v: number, le = true) {
    return this.u32(v >>> 0, le);
  }
  file(): number[] {
    const header = [12, 0x10, 0, 0, ...new Builder().u32(this.bytes.length).bytes, 0x2e, 0x46, 0x49, 0x54];
    return [...header, ...this.bytes, 0, 0];
  }
}

describe("readFitRecords", () => {
  it("reads the same positions, heights and times as Garmin's SDK", () => {
    const data = garminFile();
    const ours = readFitRecords(data);
    const { messages } = new Decoder(Stream.fromArrayBuffer(data)).read({ convertDateTimesToDates: true });
    const theirs = (messages.recordMesgs ?? []) as Array<Record<string, unknown>>;
    expect(ours).toHaveLength(theirs.length);
    theirs.forEach((r, i) => {
      expect(ours[i].lat).toBe(r.positionLat ?? null);
      expect(ours[i].lon).toBe(r.positionLong ?? null);
      expect(ours[i].altitude).toBeCloseTo((r.enhancedAltitude ?? r.altitude) as number, 6);
      expect(ours[i].time).toBe((r.timestamp as Date).getTime());
    });
  });

  it("handles compressed timestamps, big-endian messages, developer fields and chained files", () => {
    const b = new Builder();
    // Local 0: record, little-endian, timestamp + lat + lon, plus a 2-byte developer field.
    b.u8(0x60, 0, 0).u16(20).u8(3, 253, 4, 0x86, 0, 4, 0x85, 1, 4, 0x85).u8(1, 0, 2, 0);
    const t0 = Date.UTC(2027, 2, 10, 8, 0, 20) / 1000 - FIT_EPOCH_S;
    b.u8(0x00).u32(t0).i32(toSemi(67.9)).i32(toSemi(18.5)).u8(9, 9);
    // Local 1: record, big-endian, lat + lon + altitude, no timestamp.
    b.u8(0x41, 0, 1).u16(20, false).u8(3, 0, 4, 0x85, 1, 4, 0x85, 2, 2, 0x84);
    // Compressed header for local 1: the low 5 bits of t0 + 25 (gaps under 32 s).
    // t0 ends in 20, so 20 + 25 wraps past a multiple of 32.
    expect(t0 & 0x1f).toBe(20);
    const offset = (t0 + 25) & 0x1f;
    b.u8(0x80 | (1 << 5) | offset).i32(toSemi(67.91), false).i32(toSemi(18.51), false).u16((900 + 500) * 5, false);
    const second = new Builder();
    second.u8(0x40, 0, 0).u16(20).u8(2, 0, 4, 0x85, 1, 4, 0x85);
    second.u8(0x00).i32(toSemi(67.92)).i32(toSemi(18.52));
    const data = new Uint8Array([...b.file(), ...second.file()]).buffer;

    const records = readFitRecords(data);
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({ lat: toSemi(67.9), lon: toSemi(18.5), altitude: null, time: Date.UTC(2027, 2, 10, 8, 0, 20) });
    expect(records[1]).toEqual({ lat: toSemi(67.91), lon: toSemi(18.51), altitude: 900, time: Date.UTC(2027, 2, 10, 8, 0, 45) });
    expect(records[2]).toEqual({ lat: toSemi(67.92), lon: toSemi(18.52), altitude: null, time: null });
  });

  it("refuses files that aren't FIT", () => {
    expect(isFit(new TextEncoder().encode("<gpx></gpx>"))).toBe(false);
    expect(() => readFitRecords(new TextEncoder().encode("<gpx>not fit at all</gpx>").buffer as ArrayBuffer)).toThrow(FitError);
  });
});
