import { UPLOAD_STATUS, type MediaUploadResponse } from "@monitoring/shared-types";
import * as FileSystem from "expo-file-system/legacy";

import {
  listPendingEvidence,
  setEvidenceProgress,
  setEvidenceUploadStatus,
  setEvidenceUploaded,
} from "../milestone/repository";
import { apiUrl, authHeaders } from "./api";
import { chunk } from "./rules";

/**
 * Out-of-band binary channel. Photo BYTES are uploaded here, NOT through the
 * relational pull/push. Idempotent server-side on the file hash, so a retry
 * after a dropped connection is safe. Run BEFORE push so evidence rows carry a
 * remote_url + the server's canonical hash by the time they're synced.
 */
/** Bound concurrent uploads: a big offline backlog (50+ photos) must not
 * saturate a metered/slow site connection when the network returns. */
const UPLOAD_CONCURRENCY = 3;

export async function uploadPendingEvidence(): Promise<void> {
  const pending = listPendingEvidence().filter((f) => f.localUri);
  for (const batch of chunk(pending, UPLOAD_CONCURRENCY)) {
    await Promise.all(batch.map(uploadOne));
  }
}

async function uploadOne(file: { id: string; localUri: string | null; hash: string }): Promise<void> {
  if (!file.localUri) return;
  try {
    setEvidenceUploadStatus(file.id, UPLOAD_STATUS.UPLOADING);
    setEvidenceProgress(file.id, 0);
    const headers = await authHeaders();

    // Native multipart upload with live progress. fetch/XHR + FormData with a
    // file URI fails in Expo Go ("Network request failed" before the request
    // is even sent); uploadAsync streams the file natively and reliably.
    const task = FileSystem.createUploadTask(
      apiUrl("/media/upload"),
      file.localUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: "image/jpeg",
        headers,
      },
      (p) => {
        if (p.totalBytesExpectedToSend > 0) {
          setEvidenceProgress(file.id, (p.totalBytesSent / p.totalBytesExpectedToSend) * 100);
        }
      },
    );
    const res = await task.uploadAsync();
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`upload ${res?.status ?? "failed"}`);
    const json = JSON.parse(res.body) as MediaUploadResponse;
    setEvidenceProgress(file.id, 100);
    setEvidenceUploaded(file.id, json.remote_url, json.hash);
  } catch {
    setEvidenceUploadStatus(file.id, UPLOAD_STATUS.FAILED); // retried next pass
  }
}
