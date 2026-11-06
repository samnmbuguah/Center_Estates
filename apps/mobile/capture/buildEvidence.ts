import {
  GEOFENCE_STATUS,
  MEDIA_TYPE,
  UPLOAD_STATUS,
  classifyGeofence,
  type GeofenceStatus,
  type MediaType,
  type ProjectRow,
} from "@monitoring/shared-types";

/**
 * Pure capture logic — no camera, no DB, no native modules — so it is fully
 * unit-testable. Turns a raw capture + the selected project into the field
 * values for a new local evidence row (TinyBase / expo-sqlite), plus a human warning if the photo
 * looks off-site. The server re-derives the authoritative geofence verdict on
 * sync; this is only an at-capture hint for the Clerk.
 */
export interface CaptureInput {
  milestoneEntryId: string;
  /** photo (default) / 360 / drone / document. */
  mediaType?: MediaType;
  localUri: string;
  /** Provisional hash; the upload step replaces it with the server's canonical
   *  sha256 of the bytes before submission. */
  hash: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: number;
}

export interface EvidenceDraft {
  milestoneEntryId: string;
  mediaType: MediaType;
  localUri: string;
  uploadStatus: typeof UPLOAD_STATUS.PENDING;
  remoteUrl: null;
  hash: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: number;
  geofenceStatus: GeofenceStatus;
  distanceM: number | null;
}

export interface BuiltEvidence {
  draft: EvidenceDraft;
  warning: string | null;
}

export function buildEvidenceDraft(input: CaptureInput, project: ProjectRow): BuiltEvidence {
  const { status, distanceM } = classifyGeofence(
    { latitude: input.latitude, longitude: input.longitude },
    {
      latitude: project.site_latitude,
      longitude: project.site_longitude,
      radiusM: project.geofence_radius_m,
    },
  );

  let warning: string | null = null;
  if (status === GEOFENCE_STATUS.OUTSIDE) {
    const d = distanceM != null ? ` (${Math.round(distanceM)} m from site)` : "";
    warning = `This photo appears to be outside the project site${d}. It will be flagged for review.`;
  } else if (status === GEOFENCE_STATUS.UNKNOWN && input.latitude == null) {
    warning = "No GPS fix — location could not be verified.";
  }

  return {
    draft: {
      milestoneEntryId: input.milestoneEntryId,
      mediaType: input.mediaType ?? MEDIA_TYPE.PHOTO,
      localUri: input.localUri,
      uploadStatus: UPLOAD_STATUS.PENDING,
      remoteUrl: null,
      hash: input.hash,
      latitude: input.latitude,
      longitude: input.longitude,
      capturedAt: input.capturedAt,
      geofenceStatus: status,
      distanceM,
    },
    warning,
  };
}
