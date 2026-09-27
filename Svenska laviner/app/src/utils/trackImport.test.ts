import { describe, expect, it } from "vitest";
import { Encoder, Profile } from "@garmin/fitsdk";
import { importTrackFile, parseGpx, simplify, type TrackPoint } from "./trackImport";

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Kebnekaise sydtopp</name><trkseg>
    <trkpt lat="67.8510" lon="18.5970"><ele>700.4</ele><time>2027-03-10T08:00:00Z</time></trkpt>
    <trkpt lat="67.8600" lon="18.5900"><ele>820</ele><time>2027-03-10T08:30:00Z</time></trkpt>
    <trkpt lat="67.8700" lon="18.5800"><time>2027-03-10T09:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

const file = (content: BlobPart, name: string) => Object.assign(new Blob([content]), { name });

describe("parseGpx", () => {
  it("reads positions, elevations and times", () => {
    expect(parseGpx(GPX)).toEqual([
      [67.851, 18.597, 700.4, Date.UTC(2027, 2, 10, 8, 0)],
      [67.86, 18.59, 820, Date.UTC(2027, 2, 10, 8, 30)],
      [67.87, 18.58, null, Date.UTC(2027, 2, 10, 9, 0)],
    ]);
  });

  it("rejects something that isn't XML", () => {
    expect(() => parseGpx("inte en gpx")).toThrow(/GPX/);
  });
});

describe("FIT files", () => {
  it("reads records from a FIT file, converting semicircles to degrees", async () => {
    const encoder = new Encoder();
    // The SDK's Mesg type doesn't list profile fields, so cast plain objects.
    type Mesg = Parameters<Encoder["onMesg"]>[1];
    const mesg = (m: Record<string, unknown>) => m as unknown as Mesg;
    encoder.onMesg(
      Profile.MesgNum.FILE_ID,
      mesg({ type: "activity", manufacturer: "garmin", timeCreated: new Date(Date.UTC(2027, 2, 10, 8)) })
    );
    const toSemi = (deg: number) => Math.round((deg * 2 ** 31) / 180);
    for (let i = 0; i < 3; i++) {
      encoder.onMesg(
        Profile.MesgNum.RECORD,
        mesg({
          timestamp: new Date(Date.UTC(2027, 2, 10, 8, i * 10)),
          positionLat: toSemi(67.85 + i * 0.01),
          positionLong: toSemi(18.6),
          enhancedAltitude: 700 + i * 50,
        })
      );
    }
    const points = await importTrackFile(file(encoder.close().slice(), "Morning_Ski.fit"));
    expect(points).toHaveLength(3);
    expect(points[0][0]).toBeCloseTo(67.85, 5);
    expect(points[2][1]).toBeCloseTo(18.6, 5);
    expect(points[1][2]).toBeCloseTo(750, 0);
    expect(points[2][3]).toBe(Date.UTC(2027, 2, 10, 8, 20));
  });
});

describe("importTrackFile", () => {
  it("reads a GPX file and explains when there is no track", async () => {
    await expect(importTrackFile(file(GPX, "tur.gpx"))).resolves.toHaveLength(3);
    await expect(importTrackFile(file('<gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>', "tom.gpx"))).rejects.toThrow(
      /Hittade inget GPS-spår/
    );
  });
});

describe("simplify", () => {
  it("drops points closer than 10 m but keeps the ends, and caps the count", () => {
    const dense: TrackPoint[] = Array.from({ length: 1001 }, (_, i) => [67.85 + i * 0.00001, 18.6, null, null]); // ~1 m apart
    const out = simplify(dense);
    expect(out[0]).toEqual(dense[0]);
    expect(out.at(-1)).toEqual(dense.at(-1));
    expect(out.length).toBeLessThan(120);

    const long: TrackPoint[] = Array.from({ length: 20_000 }, (_, i) => [60 + i * 0.001, 15, null, null]);
    expect(simplify(long, 5000)).toHaveLength(5000);
  });
});
