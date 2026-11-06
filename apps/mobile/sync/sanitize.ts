import { SYNC_TABLES, UPLOAD_STATUS } from "@monitoring/shared-types";

export interface TableChange {
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
}
export type RawChanges = Record<string, TableChange>;

/**
 * Strip device-local fields before push, and hold back evidence whose photo has
 * not finished uploading (no remote_url) so we never push a dangling reference.
 * Pure + unit-tested.
 */
export function sanitizeForPush(changes: RawChanges): RawChanges {
  const evidence = changes[SYNC_TABLES.EVIDENCE_FILES];
  if (!evidence) return changes;

  const clean = (rows: Record<string, unknown>[]) =>
    rows
      .filter((r) => r["upload_status"] === UPLOAD_STATUS.DONE && Boolean(r["remote_url"]))
      .map(({ local_uri, upload_status, ...rest }) => rest);

  return {
    ...changes,
    [SYNC_TABLES.EVIDENCE_FILES]: {
      created: clean(evidence.created ?? []),
      updated: clean(evidence.updated ?? []),
      deleted: evidence.deleted ?? [],
    },
  };
}
