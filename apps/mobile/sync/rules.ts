/**
 * Pure sync rules — no store/native imports so they unit-test in node.
 */
import type { Row } from "tinybase";

/**
 * Conflict rule for pull (local-wins for unpushed work): a locally-dirty row
 * holds edits the server hasn't accepted yet — push runs before pull, so
 * anything still dirty here was deliberately held back (e.g. evidence waiting
 * on its upload) or failed to push. Overwriting it would silently lose the
 * Clerk's offline work.
 */
export function shouldApplyServerRow(localRow: Row | undefined): boolean {
  return !localRow || !localRow._dirty;
}

/** Split a backlog into fixed-size batches (bounded upload concurrency). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
