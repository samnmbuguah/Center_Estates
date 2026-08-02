import { useEffect, useState } from "react";

import { addOfficeNote, fetchPendingVerifications, mediaUrl, verifyMilestone } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { verificationChecklist } from "../lib/verification";

const CHECK_ICON = { pass: "✓", warn: "!", fail: "✕" } as const;
const CHECK_COLOR = { pass: "var(--success, #34d399)", warn: "var(--warning)", fail: "var(--danger)" } as const;

function geoBadge(status: string, distance: number | null) {
  if (status === "inside") return { label: "On site", color: "var(--success, #34d399)" };
  if (status === "outside")
    return { label: `Off site${distance ? ` · ${distance}m` : ""}`, color: "var(--danger)" };
  return { label: "Location unknown", color: "var(--warning)" };
}

export function Verifications() {
  const { me } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [clarificationDrafts, setClarificationDrafts] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    fetchPendingVerifications().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: string, note = "") {
    setError(null);
    try {
      await verifyMilestone(id, decision, note);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // OBS-01a / REP-02: append an office note without touching the submitted evidence.
  async function saveNote(milestoneEntryId: string) {
    const body = (noteDrafts[milestoneEntryId] ?? "").trim();
    if (!body) return;
    setError(null);
    setNotice(null);
    try {
      await addOfficeNote({
        id: crypto.randomUUID(),
        milestone_entry_id: milestoneEntryId,
        body,
        author: me?.username ?? "office",
      });
      setNoteDrafts((d) => ({ ...d, [milestoneEntryId]: "" }));
      setNotice("Office note added. Submitted evidence is unchanged.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Milestone Verification</h2>
      <p className="muted">
        Review the evidence and confirm it was captured on site before approving.
      </p>
      <ErrorBanner message={error} />
      {notice && <div className="card" role="status">{notice}</div>}

      {loading ? <p className="muted">Loading...</p> : rows.length === 0 ? <div className="card muted">Nothing pending verification.</div> : (<>
      {rows.map((r) => {
        const checks = verificationChecklist(r);
        const offSite = r.geofence_summary?.off_site > 0;
        return (
          <div className="card" key={r.milestone_entry_id} style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>{r.milestone_id}</h3>
              <span className="muted">{r.percent_complete}% complete</span>
            </div>

            {/* What to verify — at a glance */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "10px 0 14px" }}>
              {checks.map((c) => (
                <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <span style={{
                    display: "inline-grid", placeItems: "center", width: 18, height: 18, borderRadius: 9,
                    background: CHECK_COLOR[c.status], color: "#0b1016", fontWeight: 800, fontSize: 12,
                  }}>{CHECK_ICON[c.status]}</span>
                  {c.label}
                </span>
              ))}
            </div>

            {/* Evidence gallery — the photos being approved, with on-site verdict */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(r.evidence ?? []).map((e: any) => {
                const b = geoBadge(e.geofence_status, e.distance_m);
                return (
                  <a key={e.id} href={mediaUrl(e.url)} target="_blank" rel="noreferrer"
                    style={{ position: "relative", display: "block" }}>
                    <img
                      src={mediaUrl(e.url)}
                      alt={`Evidence (${b.label})`}
                      loading="lazy"
                      style={{
                        width: 168, height: 126, objectFit: "cover", borderRadius: 8,
                        border: `2px solid ${b.color}`,
                      }}
                    />
                    <span style={{
                      position: "absolute", left: 6, bottom: 6, background: b.color, color: "#0b1016",
                      fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
                    }}>{b.label}</span>
                  </a>
                );
              })}
              {(r.evidence ?? []).length === 0 && <span className="muted">No photos attached.</span>}
            </div>

            {/* Field observations */}
            {(r.observations ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                {r.observations.map((o: any) => (
                  <p key={o.id} style={{ margin: "4px 0", fontSize: 13 }}>
                    {o.flag !== "none" && (
                      <span className="badge" style={{
                        background: o.flag === "urgent" ? "var(--danger)" : "var(--warning)", marginRight: 8,
                      }}>{o.flag === "urgent" ? "URGENT" : "ISSUE"}</span>
                    )}
                    {o.body}
                  </p>
                ))}
              </div>
            )}

            {/* Office note (append-only) + decision */}
            <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
              <input
                style={{ flex: 1, minWidth: 200 }}
                placeholder="Add office note (doesn't alter evidence)…"
                aria-label={`Office note for ${r.milestone_id}`}
                value={noteDrafts[r.milestone_entry_id] ?? ""}
                onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.milestone_entry_id]: e.target.value }))}
              />
              <button className="btn ghost sm" disabled={!(noteDrafts[r.milestone_entry_id] ?? "").trim()}
                onClick={() => saveNote(r.milestone_entry_id)}>Save note</button>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn" onClick={() => decide(r.milestone_entry_id, "verified")}>
                {offSite ? "Verify anyway" : "Verify"}
              </button>
              <button className="btn danger" onClick={() => decide(r.milestone_entry_id, "rejected")}>Reject</button>
              <input
                style={{ flex: 1, minWidth: 160 }}
                placeholder="Clarification request note…"
                aria-label={`Clarification note for ${r.milestone_id}`}
                value={clarificationDrafts[r.milestone_entry_id] ?? ""}
                onChange={(e) => setClarificationDrafts((d) => ({ ...d, [r.milestone_entry_id]: e.target.value }))}
              />
              <button className="btn ghost" disabled={!(clarificationDrafts[r.milestone_entry_id] ?? "").trim()}
                onClick={() => {
                  const note = (clarificationDrafts[r.milestone_entry_id] ?? "").trim();
                  decide(r.milestone_entry_id, "request_clarification", note);
                  setClarificationDrafts((d) => ({ ...d, [r.milestone_entry_id]: "" }));
                }}>Request Clarification</button>
              {offSite && <span className="muted" style={{ alignSelf: "center" }}>⚠ Off-site evidence — confirm before approving.</span>}
            </div>
          </div>
        );
      })}
      </>)}
    </div>
  );
}
