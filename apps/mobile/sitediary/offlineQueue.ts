/**
 * Offline queue for site diary submissions (daily logs, materials, incidents).
 *
 * When the device is offline, submissions are stored locally in a TinyBase table
 * and automatically submitted when connectivity returns. This avoids the current
 * pattern of requiring a live connection for all diary entries.
 */
import * as Crypto from "expo-crypto";
import { store } from "../store/tinybase";

const QUEUE_TABLE = "_site_diary_queue";

export interface QueuedSubmission {
  id: string;
  type: "daily_log" | "material_delivery" | "safety_incident";
  project_id: string;
  payload: string; // JSON-serialized
  created_at: number;
  retries: number;
  last_error: string | null;
}

export function initQueueTable() {
  if (!store.hasTable(QUEUE_TABLE)) {
    store.setTable(QUEUE_TABLE, {});
  }
}

export function enqueueSubmission(
  type: QueuedSubmission["type"],
  project_id: string,
  payload: Record<string, unknown>,
): string {
  initQueueTable();
  const id = Crypto.randomUUID();
  store.setRow(QUEUE_TABLE, id, {
    id,
    type,
    project_id,
    payload: JSON.stringify(payload),
    created_at: Date.now(),
    retries: 0,
    last_error: null,
  });
  return id;
}

export function getPendingSubmissions(): QueuedSubmission[] {
  initQueueTable();
  const rows = store.getTable(QUEUE_TABLE);
  return Object.values(rows).map((r: any) => ({
    id: r.id,
    type: r.type,
    project_id: r.project_id,
    payload: r.payload,
    created_at: r.created_at,
    retries: r.retries,
    last_error: r.last_error,
  })) as QueuedSubmission[];
}

export function removeSubmission(id: string) {
  store.delRow(QUEUE_TABLE, id);
}

export function markSubmissionFailed(id: string, error: string) {
  const row = store.getRow(QUEUE_TABLE, id);
  if (row) {
    store.setRow(QUEUE_TABLE, id, {
      ...row,
      retries: (row.retries as number) + 1,
      last_error: error,
    });
  }
}

export function pendingSubmissionCount(): number {
  return getPendingSubmissions().length;
}
