/** SRS-MOB-OBS-02: observations may be flagged as Issue / Urgent Issue. */
export const ISSUE_FLAG = {
  NONE: "none",
  ISSUE: "issue",
  URGENT: "urgent",
} as const;
export type IssueFlag = (typeof ISSUE_FLAG)[keyof typeof ISSUE_FLAG];

/** Kinds of site evidence (SRS evidence capture + prior-ERP parity). */
export const MEDIA_TYPE = {
  PHOTO: "photo",
  VIDEO: "video",
  PANO_360: "360",
  DRONE: "drone",
  DOCUMENT: "document",
} as const;
export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

/** Local-only lifecycle of a captured photo as it moves to the server. */
export const UPLOAD_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  DONE: "done",
  FAILED: "failed",
} as const;
export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];

/** Where an observation/note originated. Drives the OBS-01a write rules. */
export const ORIGIN = {
  MOBILE: "mobile",
  DESKTOP: "desktop",
} as const;
export type Origin = (typeof ORIGIN)[keyof typeof ORIGIN];

/** Auth token audience — used server-side to gate desktop writes. */
export const CLIENT_KIND = {
  MOBILE: "mobile",
  DESKTOP: "desktop",
} as const;
export type ClientKind = (typeof CLIENT_KIND)[keyof typeof CLIENT_KIND];
