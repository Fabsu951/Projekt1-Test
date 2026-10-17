// A small reader for the GPS points in FIT activity files (Garmin, Coros,
// Suunto, Wahoo …), written from the openly described file layout. We only
// need the "record" messages (global number 20): position, altitude and time.
// Our own code on purpose: Garmin's SDK may not be redistributed in an app.

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const RECORD = 20;
const FIELD_LAT = 0;
const FIELD_LON = 1;
const FIELD_ALTITUDE = 2;
const FIELD_ENHANCED_ALTITUDE = 78;
const FIELD_TIMESTAMP = 253;

export interface FitRecord {
  /** Semicircles, as stored in the file. */
  lat: number | null;
  lon: number | null;
  /** Metres. */
  altitude: number | null;
  /** Milliseconds since 1970 (UTC). */
  time: number | null;
}

interface FieldDef {
  num: number;
  size: number;
}

interface MessageDef {
  global: number;
  littleEndian: boolean;
  fields: FieldDef[];
  /** Bytes of developer fields after the normal ones (skipped). */
  developerBytes: number;
}

export class FitError extends Error {}

/** True when the bytes start with a FIT file header. */
export function isFit(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && (bytes[0] === 12 || bytes[0] === 14) && String.fromCharCode(...bytes.slice(8, 12)) === ".FIT";
}

export function readFitRecords(buffer: ArrayBuffer): FitRecord[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (!isFit(bytes)) throw new FitError("not a FIT file");
  const records: FitRecord[] = [];
  let start = 0;
  // A file can hold several FIT files one after another.
  while (start + 12 <= bytes.length && isFit(bytes.subarray(start))) {
    const headerSize = bytes[start];
    const dataSize = view.getUint32(start + 4, true);
    const end = Math.min(start + headerSize + dataSize, bytes.length);
    readRecords(view, start + headerSize, end, records);
    start = end + 2; // CRC
  }
  return records;
}

function readRecords(view: DataView, from: number, end: number, out: FitRecord[]) {
  const defs = new Map<number, MessageDef>();
  let lastTimestamp: number | null = null; // FIT seconds
  let pos = from;
  while (pos < end) {
    const header = view.getUint8(pos++);
    if (header & 0x80) {
      // Compressed timestamp header: a data message with a 5-bit time offset.
      const local = (header >> 5) & 0x03;
      const offset = header & 0x1f;
      const def = defs.get(local);
      if (!def) throw new FitError(`no definition for local message ${local}`);
      if (lastTimestamp !== null) {
        let ts: number = (lastTimestamp & ~0x1f) + offset;
        if (offset < (lastTimestamp & 0x1f)) ts += 0x20;
        lastTimestamp = ts;
      }
      const record = readData(view, pos, def);
      pos += messageSize(def);
      if (record) {
        if (record.time === null && lastTimestamp !== null) record.time = FIT_EPOCH_MS + lastTimestamp * 1000;
        out.push(record);
      }
      continue;
    }
    const local = header & 0x0f;
    if (header & 0x40) {
      // Definition message.
      const littleEndian = view.getUint8(pos + 1) === 0;
      const global = view.getUint16(pos + 2, littleEndian);
      const count = view.getUint8(pos + 4);
      pos += 5;
      const fields: FieldDef[] = [];
      for (let i = 0; i < count; i++) {
        fields.push({ num: view.getUint8(pos), size: view.getUint8(pos + 1) });
        pos += 3;
      }
      let developerBytes = 0;
      if (header & 0x20) {
        const devCount = view.getUint8(pos++);
        for (let i = 0; i < devCount; i++) {
          developerBytes += view.getUint8(pos + 1);
          pos += 3;
        }
      }
      defs.set(local, { global, littleEndian, fields, developerBytes });
      continue;
    }
    const def = defs.get(local);
    if (!def) throw new FitError(`no definition for local message ${local}`);
    const timestamp = readTimestamp(view, pos, def);
    if (timestamp !== null) lastTimestamp = timestamp;
    const record = readData(view, pos, def);
    pos += messageSize(def);
    if (record) out.push(record);
  }
}

function messageSize(def: MessageDef): number {
  return def.fields.reduce((sum, f) => sum + f.size, 0) + def.developerBytes;
}

/** Any message's own timestamp (field 253), used by later compressed headers. */
function readTimestamp(view: DataView, pos: number, def: MessageDef): number | null {
  for (const f of def.fields) {
    if (f.num === FIELD_TIMESTAMP && f.size === 4) {
      const v = view.getUint32(pos, def.littleEndian);
      return v === 0xffffffff ? null : v;
    }
    pos += f.size;
  }
  return null;
}

function readData(view: DataView, pos: number, def: MessageDef): FitRecord | null {
  if (def.global !== RECORD) return null;
  const record: FitRecord = { lat: null, lon: null, altitude: null, time: null };
  let enhanced: number | null = null;
  for (const f of def.fields) {
    const le = def.littleEndian;
    if ((f.num === FIELD_LAT || f.num === FIELD_LON) && f.size === 4) {
      const v = view.getInt32(pos, le);
      if (v !== 0x7fffffff) record[f.num === FIELD_LAT ? "lat" : "lon"] = v;
    } else if (f.num === FIELD_ALTITUDE && f.size === 2) {
      const v = view.getUint16(pos, le);
      if (v !== 0xffff) record.altitude = v / 5 - 500;
    } else if (f.num === FIELD_ENHANCED_ALTITUDE && f.size === 4) {
      const v = view.getUint32(pos, le);
      if (v !== 0xffffffff) enhanced = v / 5 - 500;
    } else if (f.num === FIELD_TIMESTAMP && f.size === 4) {
      const v = view.getUint32(pos, le);
      if (v !== 0xffffffff) record.time = FIT_EPOCH_MS + v * 1000;
    }
    pos += f.size;
  }
  if (enhanced !== null) record.altitude = enhanced;
  return record;
}
