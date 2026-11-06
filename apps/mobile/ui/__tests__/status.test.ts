import { describe, expect, it } from "vitest";
import { GEOFENCE_STATUS, ISSUE_FLAG, UPLOAD_STATUS } from "@monitoring/shared-types";

import { geofenceBadge, issueBadge, uploadBadge } from "../status";

describe("status badges", () => {
  it("labels an off-site photo with its distance", () => {
    expect(geofenceBadge(GEOFENCE_STATUS.OUTSIDE, 412).label).toBe("Off site (412 m)");
  });

  it("labels on-site and no-GPS", () => {
    expect(geofenceBadge(GEOFENCE_STATUS.INSIDE, 10).label).toBe("On site");
    expect(geofenceBadge(GEOFENCE_STATUS.UNKNOWN, null).label).toBe("No GPS");
  });

  it("returns no badge for plain notes, a badge for issues", () => {
    expect(issueBadge(ISSUE_FLAG.NONE)).toBeNull();
    expect(issueBadge(ISSUE_FLAG.URGENT)?.label).toBe("URGENT");
    expect(issueBadge(ISSUE_FLAG.ISSUE)?.label).toBe("Issue");
  });

  it("maps upload states to labels", () => {
    expect(uploadBadge(UPLOAD_STATUS.DONE).label).toBe("Synced");
    expect(uploadBadge(UPLOAD_STATUS.FAILED).label).toBe("Upload failed");
    expect(uploadBadge(UPLOAD_STATUS.PENDING).label).toBe("Pending");
  });
});
