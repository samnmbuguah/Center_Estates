import { describe, expect, it } from "vitest";

import { MOBILE_AUTHORITATIVE_TABLES, SYNC_TABLES } from "../tables";

describe("sync contract", () => {
  const allTables = Object.values(SYNC_TABLES);

  it("every mobile-authoritative table is a real sync table", () => {
    for (const t of MOBILE_AUTHORITATIVE_TABLES) {
      expect(allTables).toContain(t);
    }
  });

  it("office_notes is NOT mobile-authoritative (desktop may write it) — OBS-01a", () => {
    expect(MOBILE_AUTHORITATIVE_TABLES).not.toContain(SYNC_TABLES.OFFICE_NOTES);
  });

  it("evidence + milestones ARE mobile-authoritative (desktop barred)", () => {
    expect(MOBILE_AUTHORITATIVE_TABLES).toContain(SYNC_TABLES.MILESTONE_ENTRIES);
    expect(MOBILE_AUTHORITATIVE_TABLES).toContain(SYNC_TABLES.EVIDENCE_FILES);
  });

  it("table name values are unique", () => {
    expect(new Set(allTables).size).toBe(allTables.length);
  });
});
