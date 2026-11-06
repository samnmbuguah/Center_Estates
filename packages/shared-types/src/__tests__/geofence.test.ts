import { describe, expect, it } from "vitest";

import { GEOFENCE_STATUS, classifyGeofence, haversineMeters } from "../geofence";

const SITE = { latitude: -1.286389, longitude: 36.817223, radiusM: 250 };

describe("geofence (client mirror of server maths)", () => {
  it("zero distance for identical points", () => {
    expect(haversineMeters(SITE.latitude, SITE.longitude, SITE.latitude, SITE.longitude)).toBeCloseTo(0, 3);
  });

  it("~111km per degree of latitude", () => {
    expect(haversineMeters(0, 0, 1, 0)).toBeGreaterThan(110_000);
    expect(haversineMeters(0, 0, 1, 0)).toBeLessThan(112_000);
  });

  it("classifies an on-site point inside", () => {
    const r = classifyGeofence({ latitude: SITE.latitude + 0.0009, longitude: SITE.longitude }, SITE);
    expect(r.status).toBe(GEOFENCE_STATUS.INSIDE);
  });

  it("classifies a distant point outside", () => {
    const r = classifyGeofence({ latitude: SITE.latitude + 0.01, longitude: SITE.longitude }, SITE);
    expect(r.status).toBe(GEOFENCE_STATUS.OUTSIDE);
    expect(r.distanceM!).toBeGreaterThan(250);
  });

  it("is unknown without a GPS fix", () => {
    expect(classifyGeofence({ latitude: null, longitude: null }, SITE).status).toBe(
      GEOFENCE_STATUS.UNKNOWN,
    );
  });
});
