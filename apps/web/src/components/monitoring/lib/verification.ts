/**
 * What a verifier must confirm before approving a milestone (pure + tested):
 *   1. There is photographic evidence of the work.
 *   2. The photos were taken ON the site (geofence) — the anti-fraud check.
 *   3. The submission is biometrically signed (non-repudiation).
 * Flagged observations are surfaced as a caution, not a blocker.
 */
export interface GeofenceSummary {
  on_site: number;
  off_site: number;
  unknown: number;
  all_on_site: boolean;
}
export interface PendingSubmission {
  evidence_count: number;
  signature_verified: boolean;
  geofence_summary: GeofenceSummary;
  observations: { flag: string }[];
}

export interface CheckItem {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
}

export function verificationChecklist(s: PendingSubmission): CheckItem[] {
  const g = s.geofence_summary;
  const hasPhotos = s.evidence_count > 0;
  const urgent = s.observations.some((o) => o.flag === "urgent");
  const anyFlag = s.observations.some((o) => o.flag !== "none");

  return [
    {
      key: "evidence",
      label: hasPhotos ? `${s.evidence_count} photo(s) attached` : "No photographic evidence",
      status: hasPhotos ? "pass" : "fail",
    },
    {
      key: "geofence",
      label:
        g.off_site > 0
          ? `${g.off_site} photo(s) taken OFF site`
          : g.unknown > 0 && g.on_site === 0
            ? "Photo locations unknown — cannot confirm on-site"
            : "All located photos taken on site",
      status: g.off_site > 0 ? "fail" : g.all_on_site ? "pass" : "warn",
    },
    {
      key: "signature",
      label: s.signature_verified ? "Biometrically signed" : "Not digitally signed",
      status: s.signature_verified ? "pass" : "warn",
    },
    {
      key: "observations",
      label: urgent
        ? "Urgent issue raised — review before approving"
        : anyFlag
          ? "Issue flagged on this milestone"
          : "No flagged issues",
      status: urgent ? "warn" : "pass",
    },
  ];
}

/** True when nothing in the checklist is a hard failure. */
export function canApprove(s: PendingSubmission): boolean {
  return !verificationChecklist(s).some((c) => c.status === "fail");
}
