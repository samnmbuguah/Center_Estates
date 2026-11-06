import { SYNC_TABLES, UPLOAD_STATUS } from "@monitoring/shared-types";
import type { Row } from "tinybase";

import { store } from "../store/tinybase";
import { apiUrl, authHeaders } from "./api";
import { shouldApplyServerRow } from "./rules";
import { sanitizeForPush, type RawChanges, type TableChange } from "./sanitize";

const T = SYNC_TABLES;
const LAST_PULLED = "last_pulled_at";
// Tables the mobile client OWNS (pushes). office_notes is pull-only.
const PUSH_TABLES = [T.MILESTONE_ENTRIES, T.EVIDENCE_FILES, T.OBSERVATIONS];
const PULL_TABLES = [T.MILESTONE_ENTRIES, T.EVIDENCE_FILES, T.OBSERVATIONS, T.OFFICE_NOTES];

const s = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const orNull = (v: unknown) => (num(v) > 0 ? num(v) : null);
const strOrNull = (v: unknown) => (s(v) ? s(v) : null);

function entries(table: string): [string, Row][] {
  return Object.entries(store.getTable(table)) as [string, Row][];
}

/** Map a local row to the server's writable shape, per table. */
function toServer(table: string, id: string, r: Row): Record<string, unknown> {
  if (table === T.MILESTONE_ENTRIES) {
    return { id, project_id: s(r.project_id), milestone_id: s(r.milestone_id),
      percent_complete: num(r.percent_complete), submitted_at: orNull(r.submitted_at),
      client_signature: strOrNull(r.client_signature), signing_device_id: strOrNull(r.signing_device_id) };
  }
  if (table === T.EVIDENCE_FILES) {
    return { id, milestone_entry_id: s(r.milestone_entry_id), media_type: s(r.media_type),
      remote_url: s(r.remote_url), hash: s(r.hash),
      latitude: r.has_location ? num(r.latitude) : null,
      longitude: r.has_location ? num(r.longitude) : null,
      captured_at: num(r.captured_at), submitted_at: orNull(r.submitted_at),
      // local-only fields, used by sanitizeForPush then stripped:
      upload_status: s(r.upload_status), local_uri: s(r.local_uri) };
  }
  return { id, milestone_entry_id: s(r.milestone_entry_id), body: s(r.body),
    flag: s(r.flag), origin: s(r.origin) };
}

/** Apply a server row into the local store (clean, not dirty). */
function applyServerRow(table: string, row: Record<string, unknown>): void {
  const base = { created_at: num(row.created_at), updated_at: num(row.updated_at), _dirty: 0, _deleted: 0 };
  if (table === T.MILESTONE_ENTRIES) {
    store.setRow(table, String(row.id), { ...base, project_id: s(row.project_id),
      milestone_id: s(row.milestone_id), percent_complete: num(row.percent_complete),
      submitted_at: num(row.submitted_at), client_signature: s(row.client_signature),
      signing_device_id: s(row.signing_device_id) });
  } else if (table === T.EVIDENCE_FILES) {
    const existing = store.getRow(table, String(row.id)) as Row | undefined;
    const hasLoc = row.latitude != null && row.longitude != null;
    const preservedLocalUri = s(existing?.local_uri) || "";
    store.setRow(table, String(row.id), { ...base, milestone_entry_id: s(row.milestone_entry_id),
      media_type: s(row.media_type) || "photo", remote_url: s(row.remote_url), hash: s(row.hash),
      latitude: num(row.latitude), longitude: num(row.longitude), has_location: hasLoc,
      captured_at: num(row.captured_at), submitted_at: num(row.submitted_at),
      geofence_status: s(row.geofence_status) || "unknown",
      distance_m: num(row.distance_m), has_distance: row.distance_m != null,
      upload_status: UPLOAD_STATUS.DONE, local_uri: preservedLocalUri });
  } else if (table === T.OBSERVATIONS) {
    store.setRow(table, String(row.id), { ...base, milestone_entry_id: s(row.milestone_entry_id),
      body: s(row.body), flag: s(row.flag), origin: s(row.origin) });
  } else if (table === T.OFFICE_NOTES) {
    store.setRow(table, String(row.id), { ...base, milestone_entry_id: s(row.milestone_entry_id),
      body: s(row.body), author: s(row.author) });
  }
}

function buildChanges(): RawChanges {
  const changes: RawChanges = {};
  for (const table of PUSH_TABLES) {
    const change: TableChange = { created: [], updated: [], deleted: [] };
    for (const [id, r] of entries(table)) {
      if (!r._dirty) continue;
      if (r._deleted) change.deleted.push(id);
      else change.updated.push(toServer(table, id, r)); // server upserts by id
    }
    changes[table] = change;
  }
  return sanitizeForPush(changes);
}

export async function push(): Promise<void> {
  const changes = buildChanges();
  const hasWork = Object.values(changes).some((c) => c.created.length || c.updated.length || c.deleted.length);
  if (!hasWork) return;

  const res = await fetch(apiUrl("/sync/push"), {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);

  // Clear dirty flags / drop tombstones for everything we pushed.
  for (const table of PUSH_TABLES) {
    for (const [id, r] of entries(table)) {
      if (!r._dirty) continue;
      if (r._deleted) store.delRow(table, id);
      // evidence not yet uploaded was held back by sanitize — keep it dirty
      else if (table === T.EVIDENCE_FILES && s(r.upload_status) !== UPLOAD_STATUS.DONE) continue;
      else store.setCell(table, id, "_dirty", 0);
    }
  }
}

export async function pull(): Promise<void> {
  const last = num(store.getValue(LAST_PULLED));
  const res = await fetch(apiUrl(`/sync/pull?last_pulled_at=${last}`), {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const { changes, timestamp } = (await res.json()) as {
    changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }>;
    timestamp: number;
  };
  for (const table of PULL_TABLES) {
    const c = changes[table];
    if (!c) continue;
    for (const row of [...c.created, ...c.updated]) {
      if (!shouldApplyServerRow(store.getRow(table, String(row.id)) as Row | undefined)) continue;
      applyServerRow(table, row);
    }
    for (const id of c.deleted) store.delRow(table, id);
  }
  // Stamp the boundary only after every row is applied: if we crash mid-pull,
  // the next pull re-fetches the same window and the upserts re-apply cleanly.
  store.setValue(LAST_PULLED, timestamp);
}
