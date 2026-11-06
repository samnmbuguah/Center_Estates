import { describe, expect, it } from "vitest";
import { SYNC_TABLES, UPLOAD_STATUS } from "@monitoring/shared-types";

import { sanitizeForPush } from "../sanitize";

const emptyOthers = {
  [SYNC_TABLES.MILESTONE_ENTRIES]: { created: [], updated: [], deleted: [] },
  [SYNC_TABLES.OBSERVATIONS]: { created: [], updated: [], deleted: [] },
  [SYNC_TABLES.OFFICE_NOTES]: { created: [], updated: [], deleted: [] },
};

function evidenceRow(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    milestone_entry_id: "m1",
    local_uri: "file:///tmp/photo.jpg",
    upload_status: UPLOAD_STATUS.DONE,
    remote_url: "/media/evidence/ab/hash.jpg",
    hash: "hash",
    captured_at: 1000,
    submitted_at: null,
    ...over,
  };
}

describe("sanitizeForPush", () => {
  it("strips local-only fields from synced evidence rows", () => {
    const out = sanitizeForPush({
      ...emptyOthers,
      [SYNC_TABLES.EVIDENCE_FILES]: { created: [evidenceRow()], updated: [], deleted: [] },
    } as never);

    const row = (out[SYNC_TABLES.EVIDENCE_FILES] as any).created[0];
    expect(row).not.toHaveProperty("local_uri");
    expect(row).not.toHaveProperty("upload_status");
    expect(row.remote_url).toBe("/media/evidence/ab/hash.jpg");
  });

  it("holds back evidence whose photo has not finished uploading", () => {
    const out = sanitizeForPush({
      ...emptyOthers,
      [SYNC_TABLES.EVIDENCE_FILES]: {
        created: [
          evidenceRow({ id: "pending", upload_status: UPLOAD_STATUS.PENDING, remote_url: null }),
          evidenceRow({ id: "done" }),
        ],
        updated: [],
        deleted: [],
      },
    } as never);

    const ids = (out[SYNC_TABLES.EVIDENCE_FILES] as any).created.map((r: any) => r.id);
    expect(ids).toEqual(["done"]);
  });

  it("never pushes a row with a missing remote_url even if marked done", () => {
    const out = sanitizeForPush({
      ...emptyOthers,
      [SYNC_TABLES.EVIDENCE_FILES]: {
        created: [evidenceRow({ remote_url: null })],
        updated: [],
        deleted: [],
      },
    } as never);
    expect((out[SYNC_TABLES.EVIDENCE_FILES] as any).created).toHaveLength(0);
  });

  it("passes deletions through untouched", () => {
    const out = sanitizeForPush({
      ...emptyOthers,
      [SYNC_TABLES.EVIDENCE_FILES]: { created: [], updated: [], deleted: ["gone"] },
    } as never);
    expect((out[SYNC_TABLES.EVIDENCE_FILES] as any).deleted).toEqual(["gone"]);
  });
});
