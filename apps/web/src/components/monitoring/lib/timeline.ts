/**
 * Photo-timeline grouping (industry pattern: OpenSpace's comparable captures
 * over time). Groups GPS-tagged evidence photos by milestone, then by capture
 * date, so the office can flick through "this work area on every visit".
 * Pure + unit-tested; the page just renders the result.
 */
import type { EvidenceFileRow, MilestoneEntryRow } from "../shared-types";

export interface TimelinePhoto {
  id: string;
  url: string;
  capturedAt: number;
  geofenceStatus: string;
}

export interface TimelineDay {
  date: string; // YYYY-MM-DD (UTC)
  photos: TimelinePhoto[];
}

export interface MilestoneTimeline {
  projectId: string;
  milestoneId: string;
  days: TimelineDay[];
}

const dayOf = (epochMs: number) => new Date(epochMs).toISOString().slice(0, 10);

export function buildTimeline(
  entries: Pick<MilestoneEntryRow, "id" | "project_id" | "milestone_id">[],
  evidence: Pick<
    EvidenceFileRow,
    "id" | "milestone_entry_id" | "remote_url" | "captured_at" | "geofence_status"
  >[],
): MilestoneTimeline[] {
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const byMilestone = new Map<string, { projectId: string; milestoneId: string; photos: TimelinePhoto[] }>();
  for (const file of evidence) {
    const entry = entryById.get(file.milestone_entry_id);
    if (!entry || !file.remote_url) continue;
    const key = `${entry.project_id}::${entry.milestone_id}`;
    let bucket = byMilestone.get(key);
    if (!bucket) {
      bucket = { projectId: entry.project_id, milestoneId: entry.milestone_id, photos: [] };
      byMilestone.set(key, bucket);
    }
    bucket.photos.push({
      id: file.id,
      url: file.remote_url,
      capturedAt: file.captured_at,
      geofenceStatus: file.geofence_status,
    });
  }

  const result: MilestoneTimeline[] = [];
  for (const bucket of byMilestone.values()) {
    const byDay = new Map<string, TimelinePhoto[]>();
    for (const photo of bucket.photos) {
      const day = dayOf(photo.capturedAt);
      (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(photo);
    }
    const days: TimelineDay[] = [...byDay.entries()]
      .map(([date, photos]) => ({
        date,
        photos: [...photos].sort((a, b) => a.capturedAt - b.capturedAt),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    result.push({ projectId: bucket.projectId, milestoneId: bucket.milestoneId, days });
  }

  return result.sort((a, b) => a.milestoneId.localeCompare(b.milestoneId));
}
