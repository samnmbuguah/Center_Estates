import type { IssueFlag, MediaType, Origin } from "./enums";
import type { GeofenceStatus } from "./geofence";

/** Epoch milliseconds. WatermelonDB uses ms precision; the server must too. */
export type EpochMs = number;

/**
 * Server-managed sync bookkeeping present on every syncable row.
 * `id` is a client-generated UUID — WatermelonDB owns the primary key.
 * `created_at` / `updated_at` are stamped by the SERVER (single clock).
 */
export interface SyncMeta {
  id: string;
  created_at: EpochMs;
  updated_at: EpochMs;
}

export interface MilestoneEntryRow extends SyncMeta {
  project_id: string;
  milestone_id: string;
  percent_complete: number;
  /** Set once on submit. After this is set the row is IMMUTABLE server-side. */
  submitted_at: EpochMs | null;
  /** Base64 Ed25519 signature over the integrity hash, made at submit time. */
  client_signature: string | null;
  /** Enrolled device that produced client_signature (biometric-gated key). */
  signing_device_id: string | null;
}

export interface EvidenceFileRow extends SyncMeta {
  milestone_entry_id: string;
  media_type: MediaType;
  /** URL on the server. Photo BYTES never travel in the sync payload. */
  remote_url: string;
  /** sha256 — doubles as the upload idempotency key. */
  hash: string;
  latitude: number | null;
  longitude: number | null;
  captured_at: EpochMs;
  submitted_at: EpochMs | null;
  /** Server-computed location verification (read-only on the client). */
  geofence_status: GeofenceStatus;
  distance_m: number | null;
}

export interface ObservationRow extends SyncMeta {
  milestone_entry_id: string;
  body: string;
  flag: IssueFlag;
  origin: Origin;
}

/** Distinct relational table. Office/desktop notes that never touch evidence. */
export interface OfficeNoteRow extends SyncMeta {
  milestone_entry_id: string;
  body: string;
  author: string;
}

export interface TableChanges<T> {
  created: T[];
  updated: T[];
  deleted: string[];
}

/** Keys MUST equal the SYNC_TABLES values. */
export interface SyncChanges {
  milestone_entries: TableChanges<MilestoneEntryRow>;
  evidence_files: TableChanges<EvidenceFileRow>;
  observations: TableChanges<ObservationRow>;
  office_notes: TableChanges<OfficeNoteRow>;
}

/** GET /sync/pull?last_pulled_at=<EpochMs> */
export interface PullResponse {
  changes: SyncChanges;
  timestamp: EpochMs;
}

/** POST /sync/push */
export interface PushRequest {
  changes: SyncChanges;
}

/** POST /media/upload (multipart) -> JSON */
export interface MediaUploadResponse {
  remote_url: string;
  hash: string;
}

/** GET /projects — reference data with site geofence (read-only). */
export interface ProjectRow {
  id: string;
  name: string;
  site_latitude: number | null;
  site_longitude: number | null;
  geofence_radius_m: number | null;
}

/** GET /reports/weekly?project_id= (SRS-MOB-REP-01) */
export interface WeeklyReportWeek {
  week: string; // ISO week, e.g. "2026-W24"
  submissions: number;
  distinct_milestones: number;
  avg_percent_complete: number;
  issues: number;
  urgent_issues: number;
  /** SRS-MOB-MAT: material deliveries recorded that week. */
  material_deliveries: number;
  /** SRS-MOB-HS: health & safety incidents recorded that week. */
  hs_incidents: number;
}
export interface WeeklyReport {
  project_id: string;
  weeks: WeeklyReportWeek[];
}

/** GET /reports/scurve?project_id= — planned-vs-actual cumulative progress. */
export interface SCurvePoint {
  week: string;
  planned_percent: number;
  actual_percent: number;
}
export interface SCurve {
  project_id: string;
  series: SCurvePoint[];
}

/** GET /issues (SRS-MOB-OBS-03) */
export interface IssueRow {
  id: string;
  milestone_entry_id: string;
  project_id: string;
  milestone_id: string;
  flag: IssueFlag;
  body: string;
  origin: Origin;
  created_at: EpochMs;
}

/** GET /audit/verify/<milestone_entry_id> */
export interface VerifyResponse {
  milestone_entry_id: string;
  sealed_hash: string;
  current_hash: string;
  verified: boolean;
  sealed_at: EpochMs;
  signed: boolean;
  signature_verified: boolean;
  device_id: string | null;
  review_decision: "verified" | "rejected" | null;
  reviewed_by: string | null;
  reviewed_at: EpochMs | null;
}

/** POST /devices/register */
export interface DeviceRegistration {
  device_id: string;
  public_key: string; // base64 Ed25519 public key (32 raw bytes)
}
