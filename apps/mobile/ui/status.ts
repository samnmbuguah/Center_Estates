import {
  GEOFENCE_STATUS,
  ISSUE_FLAG,
  UPLOAD_STATUS,
  type GeofenceStatus,
  type IssueFlag,
  type UploadStatus,
} from "@monitoring/shared-types";

import { colors } from "../theme/theme";

export interface Badge {
  label: string;
  color: string;
}

/** Pure presentation helpers — unit-tested so the badges can't silently drift. */
export function geofenceBadge(status: GeofenceStatus, distanceM: number | null): Badge {
  switch (status) {
    case GEOFENCE_STATUS.INSIDE:
      return { label: "On site", color: colors.inside };
    case GEOFENCE_STATUS.OUTSIDE:
      return {
        label: distanceM != null ? `Off site (${Math.round(distanceM)} m)` : "Off site",
        color: colors.outside,
      };
    default:
      return { label: "No GPS", color: colors.unknown };
  }
}

export function issueBadge(flag: IssueFlag): Badge | null {
  switch (flag) {
    case ISSUE_FLAG.URGENT:
      return { label: "URGENT", color: colors.danger };
    case ISSUE_FLAG.ISSUE:
      return { label: "Issue", color: colors.warning };
    default:
      return null;
  }
}

export function uploadBadge(status: UploadStatus): Badge {
  switch (status) {
    case UPLOAD_STATUS.DONE:
      return { label: "Synced", color: colors.success };
    case UPLOAD_STATUS.FAILED:
      return { label: "Upload failed", color: colors.danger };
    case UPLOAD_STATUS.UPLOADING:
      return { label: "Uploading…", color: colors.warning };
    default:
      return { label: "Pending", color: colors.textMuted };
  }
}
