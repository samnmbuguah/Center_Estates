/**
 * Canonical sync table names.
 *
 * These strings are a HARD CONTRACT shared by three places:
 *   - WatermelonDB schema (apps/mobile/model/schema.ts)
 *   - Django sync registry (apps/backend/sync/views.py SYNC_TABLES)
 *   - The desktop API client (apps/desktop)
 *
 * Changing a value here is a breaking sync-protocol change. Do not rename
 * casually — coordinate a schema migration on both client and server.
 */
export const SYNC_TABLES = {
  MILESTONE_ENTRIES: "milestone_entries",
  EVIDENCE_FILES: "evidence_files",
  OBSERVATIONS: "observations",
  OFFICE_NOTES: "office_notes",
} as const;

export type SyncTableName = (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES];

/**
 * Tables for which the MOBILE device is the authoritative source of truth
 * (SRS: "the mobile system is the authoritative source of site progress
 * evidence"). Desktop tokens are FORBIDDEN from writing these — enforced
 * server-side in the push view. See OBS-01a / REP-02.
 */
export const MOBILE_AUTHORITATIVE_TABLES: SyncTableName[] = [
  SYNC_TABLES.MILESTONE_ENTRIES,
  SYNC_TABLES.EVIDENCE_FILES,
  SYNC_TABLES.OBSERVATIONS,
];
