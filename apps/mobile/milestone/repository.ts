import * as Crypto from "expo-crypto";
import {
  ISSUE_FLAG,
  ORIGIN,
  UPLOAD_STATUS,
  type GeofenceStatus,
  type IssueFlag,
  type MediaType,
  type Origin,
  type UploadStatus,
  SYNC_TABLES,
} from "@monitoring/shared-types";
import type { Row } from "tinybase";

import { ed25519Signer } from "../signing/ed25519Signer";
import { prepareSubmission } from "../signing/prepareSubmission";
import type { EvidenceDraft } from "../capture/buildEvidence";
import { store } from "../store/tinybase";
import { buildSubmissionContent, canSubmit } from "./submission";

const T = SYNC_TABLES;
const now = () => Date.now();
const uuid = () => Crypto.randomUUID();

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number => (typeof v === "number" ? v : 0);
const dateOrNull = (v: unknown): Date | null => (typeof v === "number" && v > 0 ? new Date(v) : null);

// ---- App-facing row shapes (camelCase, like the old models) ----
export interface MilestoneRow {
  id: string;
  projectId: string;
  milestoneId: string;
  percentComplete: number;
  submittedAt: Date | null;
  prerequisites?: string[];
}
export interface EvidenceRow {
  id: string;
  milestoneEntryId: string;
  mediaType: MediaType;
  localUri: string | null;
  uploadStatus: UploadStatus;
  uploadProgress: number; // 0-100, live during UPLOADING
  remoteUrl: string | null;
  hash: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: Date;
  submittedAt: Date | null;
  geofenceStatus: GeofenceStatus;
  distanceM: number | null;
}
export interface ObservationRow {
  id: string;
  milestoneEntryId: string;
  body: string;
  flag: IssueFlag;
  origin: Origin;
}

function toMilestone(id: string, r: Row): MilestoneRow {
  let prereqs: string[] = [];
  if (Array.isArray(r.prerequisites)) {
    prereqs = r.prerequisites as string[];
  } else if (typeof r.prerequisites === "string") {
    try {
      const parsed = JSON.parse(r.prerequisites);
      if (Array.isArray(parsed)) prereqs = parsed;
    } catch {}
  }
  return {
    id,
    projectId: s(r.project_id),
    milestoneId: s(r.milestone_id),
    percentComplete: n(r.percent_complete),
    submittedAt: dateOrNull(r.submitted_at),
    prerequisites: prereqs,
  };
}
function toEvidence(id: string, r: Row): EvidenceRow {
  return {
    id,
    milestoneEntryId: s(r.milestone_entry_id),
    mediaType: (s(r.media_type) || "photo") as MediaType,
    localUri: r.local_uri ? s(r.local_uri) : null,
    uploadStatus: (s(r.upload_status) || UPLOAD_STATUS.PENDING) as UploadStatus,
    uploadProgress: n(r.upload_progress),
    remoteUrl: r.remote_url ? s(r.remote_url) : null,
    hash: s(r.hash),
    latitude: r.has_location ? n(r.latitude) : null,
    longitude: r.has_location ? n(r.longitude) : null,
    capturedAt: new Date(n(r.captured_at)),
    submittedAt: dateOrNull(r.submitted_at),
    geofenceStatus: (s(r.geofence_status) || "unknown") as GeofenceStatus,
    distanceM: r.has_distance ? n(r.distance_m) : null,
  };
}
function toObservation(id: string, r: Row): ObservationRow {
  return {
    id,
    milestoneEntryId: s(r.milestone_entry_id),
    body: s(r.body),
    flag: (s(r.flag) || ISSUE_FLAG.NONE) as IssueFlag,
    origin: (s(r.origin) || ORIGIN.MOBILE) as Origin,
  };
}

function rows(table: string): [string, Row][] {
  return Object.entries(store.getTable(table)) as [string, Row][];
}
const alive = (r: Row) => !r._deleted;

// ---- Milestones ----
export async function createMilestone(projectId: string, milestoneId: string): Promise<string> {
  const id = uuid();
  store.setRow(T.MILESTONE_ENTRIES, id, {
    project_id: projectId, milestone_id: milestoneId, percent_complete: 0,
    submitted_at: 0, client_signature: "", signing_device_id: "",
    created_at: 0, updated_at: now(), _dirty: 1, _deleted: 0,
  });
  return id;
}

export async function listMilestones(projectId: string): Promise<MilestoneRow[]> {
  return rows(T.MILESTONE_ENTRIES)
    .filter(([, r]) => alive(r) && s(r.project_id) === projectId)
    .map(([id, r]) => toMilestone(id, r));
}

export async function getMilestone(id: string): Promise<MilestoneRow> {
  const r = store.getRow(T.MILESTONE_ENTRIES, id);
  if (!r || Object.keys(r).length === 0) throw new Error("milestone not found");
  return toMilestone(id, r);
}

export async function setPercent(id: string, percent: number): Promise<void> {
  store.setPartialRow(T.MILESTONE_ENTRIES, id, { percent_complete: percent, updated_at: now(), _dirty: 1 });
}

// ---- Observations ----
export async function addObservation(
  milestoneEntryId: string, body: string, flag: IssueFlag = ISSUE_FLAG.NONE,
): Promise<void> {
  store.setRow(T.OBSERVATIONS, uuid(), {
    milestone_entry_id: milestoneEntryId, body, flag, origin: ORIGIN.MOBILE,
    created_at: 0, updated_at: now(), _dirty: 1, _deleted: 0,
  });
}

export async function listObservations(milestoneEntryId: string): Promise<ObservationRow[]> {
  return rows(T.OBSERVATIONS)
    .filter(([, r]) => alive(r) && s(r.milestone_entry_id) === milestoneEntryId)
    .map(([id, r]) => toObservation(id, r));
}

// ---- Evidence ----
export function addEvidence(draft: EvidenceDraft): string {
  const id = uuid();
  store.setRow(T.EVIDENCE_FILES, id, {
    milestone_entry_id: draft.milestoneEntryId,
    media_type: draft.mediaType,
    local_uri: draft.localUri,
    upload_status: draft.uploadStatus,
    remote_url: draft.remoteUrl ?? "",
    hash: draft.hash,
    latitude: draft.latitude ?? 0,
    longitude: draft.longitude ?? 0,
    has_location: draft.latitude != null && draft.longitude != null,
    captured_at: draft.capturedAt,
    submitted_at: 0,
    geofence_status: draft.geofenceStatus,
    distance_m: draft.distanceM ?? 0,
    has_distance: draft.distanceM != null,
    created_at: 0, updated_at: now(), _dirty: 1, _deleted: 0,
  });
  return id;
}

export async function listEvidence(milestoneEntryId: string): Promise<EvidenceRow[]> {
  return rows(T.EVIDENCE_FILES)
    .filter(([, r]) => alive(r) && s(r.milestone_entry_id) === milestoneEntryId)
    .map(([id, r]) => toEvidence(id, r));
}

/** Evidence that still needs uploading: never-uploaded (PENDING) AND
 *  previously-FAILED, so a dropped connection self-heals on the next pass
 *  instead of leaving a photo stuck forever. */
export function listPendingEvidence(): EvidenceRow[] {
  return rows(T.EVIDENCE_FILES)
    .filter(([, r]) => {
      const st = s(r.upload_status);
      return alive(r) && (st === UPLOAD_STATUS.PENDING || st === UPLOAD_STATUS.FAILED);
    })
    .map(([id, r]) => toEvidence(id, r));
}

export function setEvidenceUploadStatus(id: string, status: string): void {
  store.setPartialRow(T.EVIDENCE_FILES, id, { upload_status: status, updated_at: now(), _dirty: 1 });
}

/** Re-queue a failed photo for upload. Caller then runs uploadPendingEvidence. */
export function retryEvidence(id: string): void {
  store.setPartialRow(T.EVIDENCE_FILES, id, {
    upload_status: UPLOAD_STATUS.PENDING, upload_progress: 0, updated_at: now(), _dirty: 1,
  });
}

/** Soft-delete a piece of evidence so it stops blocking submission and the
 *  deletion propagates to the server on next push. */
export function deleteEvidence(id: string): void {
  store.setPartialRow(T.EVIDENCE_FILES, id, { _deleted: 1, _dirty: 1, updated_at: now() });
}

/** Live upload progress (0-100). Local-only — not a syncable change, so it
 *  doesn't touch _dirty. */
export function setEvidenceProgress(id: string, pct: number): void {
  store.setCell(T.EVIDENCE_FILES, id, "upload_progress", Math.max(0, Math.min(100, Math.round(pct))));
}

/** Re-run `cb` whenever any evidence row changes (e.g. live upload progress).
 *  Returns an unsubscribe function. */
export function subscribeEvidence(cb: () => void): () => void {
  const id = store.addTableListener(T.EVIDENCE_FILES, () => cb());
  return () => store.delListener(id);
}

export function setEvidenceUploaded(id: string, remoteUrl: string, hash: string): void {
  store.setPartialRow(T.EVIDENCE_FILES, id, {
    remote_url: remoteUrl, hash, upload_status: UPLOAD_STATUS.DONE, upload_progress: 100,
    updated_at: now(), _dirty: 1,
  });
}

// ---- Submission ----
export interface SubmitResult { ok: boolean; reason: string | null; integrityHash?: string }

export async function submitMilestone(milestoneEntryId: string): Promise<SubmitResult> {
  const entry = await getMilestone(milestoneEntryId);
  const evidence = await listEvidence(milestoneEntryId);
  const obs = await listObservations(milestoneEntryId);

  const guard = canSubmit(
    { milestoneId: entry.milestoneId, projectId: entry.projectId,
      percentComplete: entry.percentComplete,
      submittedAt: entry.submittedAt ? entry.submittedAt.getTime() : null },
    evidence.map((e) => ({ hash: e.hash, uploadStatus: e.uploadStatus })),
  );
  if (!guard.ok) return { ok: false, reason: guard.reason };

  const submittedAt = now();
  const content = buildSubmissionContent(
    { milestoneId: entry.milestoneId, projectId: entry.projectId, percentComplete: entry.percentComplete },
    submittedAt,
    evidence.map((e) => ({ hash: e.hash, uploadStatus: e.uploadStatus })),
    obs.map((o) => ({ body: o.body })),
  );
  const prepared = await prepareSubmission(content, ed25519Signer);

  store.setPartialRow(T.MILESTONE_ENTRIES, milestoneEntryId, {
    submitted_at: prepared.submittedAt,
    client_signature: prepared.clientSignature,
    signing_device_id: prepared.signingDeviceId,
    updated_at: now(), _dirty: 1,
  });
  for (const e of evidence) {
    store.setPartialRow(T.EVIDENCE_FILES, e.id, { submitted_at: prepared.submittedAt, updated_at: now(), _dirty: 1 });
  }
  return { ok: true, reason: null, integrityHash: prepared.integrityHash };
}
