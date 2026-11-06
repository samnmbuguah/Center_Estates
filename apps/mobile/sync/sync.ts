import { uploadPendingEvidence } from "./mediaUploader";
import { pull, push } from "./syncClient";
import { flushDiaryQueue } from "../sitediary/diarySync";

/**
 * Full sync pass for the Clerk's device, safe to call whenever connectivity
 * returns (SRS-MOB-OFF: intermittent / unavailable network):
 *   1. upload photo BYTES out-of-band (so rows gain a remote_url), then
 *   2. push local relational changes, then
 *   3. pull server changes, then
 *   4. flush pending site diary submissions (daily logs, materials, incidents).
 */
export async function runSync(): Promise<void> {
  await uploadPendingEvidence();
  await push();
  await pull();
  await flushDiaryQueue();
}
