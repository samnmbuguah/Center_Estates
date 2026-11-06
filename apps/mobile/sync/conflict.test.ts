import { describe, expect, it } from "vitest";

import { chunk, shouldApplyServerRow } from "./rules";

describe("shouldApplyServerRow (pull conflict rule: local-wins for dirty rows)", () => {
  it("applies when there is no local row (fresh from server)", () => {
    expect(shouldApplyServerRow(undefined)).toBe(true);
  });

  it("applies over a clean local row", () => {
    expect(shouldApplyServerRow({ _dirty: 0, percent_complete: 40 })).toBe(true);
  });

  it("never overwrites a locally-dirty row (unpushed offline work)", () => {
    expect(shouldApplyServerRow({ _dirty: 1, percent_complete: 55 })).toBe(false);
  });
});

describe("chunk (bounded upload concurrency)", () => {
  it("splits a backlog into batches of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("handles an empty backlog", () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
