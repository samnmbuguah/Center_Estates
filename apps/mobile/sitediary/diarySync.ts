/**
 * Syncs pending site diary submissions from the offline queue to the server.
 * Called during the normal sync cycle (see sync/sync.ts) and on explicit retry.
 */
import NetInfo from "@react-native-community/netinfo";

import {
  submitDailyLog,
  submitMaterialDelivery,
  submitSafetyIncident,
  uploadProofPhoto,
} from "../api/client";
import {
  getPendingSubmissions,
  markSubmissionFailed,
  pendingSubmissionCount,
  removeSubmission,
} from "./offlineQueue";

export async function flushDiaryQueue(): Promise<{ flushed: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { flushed: 0, failed: 0 };

  const pending = getPendingSubmissions();
  if (pending.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const submission of pending) {
    if (submission.retries >= 5) {
      markSubmissionFailed(submission.id, "Max retries exceeded");
      failed++;
      continue;
    }

    try {
      const payload = JSON.parse(submission.payload);

      switch (submission.type) {
        case "daily_log":
          await submitDailyLog(payload);
          break;
        case "material_delivery":
          // Upload receipt photo first if present
          if (payload.receipt_local_uri && !payload.receipt_url) {
            payload.receipt_url = await uploadProofPhoto(payload.receipt_local_uri);
          }
          await submitMaterialDelivery(payload);
          break;
        case "safety_incident":
          // Upload any pending incident photos
          if (payload.pending_photos?.length) {
            const uploadedUrls: string[] = [];
            for (const localUri of payload.pending_photos) {
              uploadedUrls.push(await uploadProofPhoto(localUri));
            }
            payload.photo_urls = [...(payload.photo_urls || []), ...uploadedUrls];
            delete payload.pending_photos;
          }
          await submitSafetyIncident(payload);
          break;
      }

      removeSubmission(submission.id);
      flushed++;
    } catch (e) {
      markSubmissionFailed(submission.id, (e as Error).message);
      failed++;
    }
  }

  return { flushed, failed };
}

export { pendingSubmissionCount };
