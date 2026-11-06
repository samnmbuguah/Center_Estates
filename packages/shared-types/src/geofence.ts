/**
 * Client-side mirror of the server's geofence maths (apps/backend/sync/geo.py).
 * The mobile app uses this to WARN the Clerk at capture time if a photo looks
 * off-site; the server re-computes the authoritative verdict on sync.
 */
export const GEOFENCE_STATUS = {
  INSIDE: "inside",
  OUTSIDE: "outside",
  UNKNOWN: "unknown",
} as const;
export type GeofenceStatus = (typeof GEOFENCE_STATUS)[keyof typeof GEOFENCE_STATUS];

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface GeofenceResult {
  status: GeofenceStatus;
  distanceM: number | null;
}

export function classifyGeofence(
  point: { latitude: number | null; longitude: number | null },
  site: { latitude: number | null; longitude: number | null; radiusM: number | null },
): GeofenceResult {
  if (
    point.latitude == null ||
    point.longitude == null ||
    site.latitude == null ||
    site.longitude == null
  ) {
    return { status: GEOFENCE_STATUS.UNKNOWN, distanceM: null };
  }
  const distanceM = haversineMeters(point.latitude, point.longitude, site.latitude, site.longitude);
  if (site.radiusM == null) return { status: GEOFENCE_STATUS.UNKNOWN, distanceM };
  return {
    status: distanceM <= site.radiusM ? GEOFENCE_STATUS.INSIDE : GEOFENCE_STATUS.OUTSIDE,
    distanceM,
  };
}
