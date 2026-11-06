import { describe, expect, it } from "vitest";
import { GEOFENCE_STATUS, MEDIA_TYPE, UPLOAD_STATUS, type ProjectRow } from "@monitoring/shared-types";

import { buildEvidenceDraft } from "../buildEvidence";

const PROJECT: ProjectRow = {
  id: "p1",
  name: "Tower A",
  site_latitude: -1.286389,
  site_longitude: 36.817223,
  geofence_radius_m: 250,
};

const baseInput = {
  milestoneEntryId: "m1",
  localUri: "file:///photo.jpg",
  hash: "provisional",
  capturedAt: 1_700_000_000_000,
};

describe("buildEvidenceDraft", () => {
  it("marks a fresh capture pending with no remote url, defaulting to photo", () => {
    const { draft } = buildEvidenceDraft(
      { ...baseInput, latitude: PROJECT.site_latitude, longitude: PROJECT.site_longitude },
      PROJECT,
    );
    expect(draft.uploadStatus).toBe(UPLOAD_STATUS.PENDING);
    expect(draft.remoteUrl).toBeNull();
    expect(draft.mediaType).toBe(MEDIA_TYPE.PHOTO);
  });

  it("carries an explicit media type (e.g. drone)", () => {
    const { draft } = buildEvidenceDraft(
      { ...baseInput, mediaType: MEDIA_TYPE.DRONE, latitude: null, longitude: null },
      PROJECT,
    );
    expect(draft.mediaType).toBe(MEDIA_TYPE.DRONE);
  });

  it("flags an off-site photo and warns the Clerk", () => {
    const { draft, warning } = buildEvidenceDraft(
      { ...baseInput, latitude: PROJECT.site_latitude! + 0.01, longitude: PROJECT.site_longitude! },
      PROJECT,
    );
    expect(draft.geofenceStatus).toBe(GEOFENCE_STATUS.OUTSIDE);
    expect(warning).toMatch(/outside the project site/);
  });

  it("accepts an on-site photo without warning", () => {
    const { draft, warning } = buildEvidenceDraft(
      { ...baseInput, latitude: PROJECT.site_latitude! + 0.0009, longitude: PROJECT.site_longitude! },
      PROJECT,
    );
    expect(draft.geofenceStatus).toBe(GEOFENCE_STATUS.INSIDE);
    expect(warning).toBeNull();
  });

  it("warns when there is no GPS fix", () => {
    const { draft, warning } = buildEvidenceDraft(
      { ...baseInput, latitude: null, longitude: null },
      PROJECT,
    );
    expect(draft.geofenceStatus).toBe(GEOFENCE_STATUS.UNKNOWN);
    expect(warning).toMatch(/No GPS fix/);
  });
});
