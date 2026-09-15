import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, MessageCircleQuestion, Search } from "lucide-react";
import { fetchMilestoneVerifications } from "../api";
import { ErrorBanner } from "../components";
import type { MilestoneVerificationRecord } from "../api-types";

const DECISION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  verified: { label: "Verified", color: "var(--color-green)", icon: <ShieldCheck size={14} /> },
  rejected: { label: "Rejected", color: "var(--color-danger)", icon: <ShieldX size={14} /> },
  request_clarification: { label: "Clarification", color: "var(--color-amber)", icon: <MessageCircleQuestion size={14} /> },
};

export function MilestoneVerifications() {
  const [rows, setRows] = useState<MilestoneVerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchMilestoneVerifications().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    if (decisionFilter && r.decision !== decisionFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.milestone_name ?? "").toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q) || (r.verifier_name ?? "").toLowerCase().includes(q);
  });

  const counts = rows.reduce((acc, r) => { acc[r.decision] = (acc[r.decision] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div>
      <h2>Progress Verification</h2>
      <p className="muted" style={{ fontSize: 13 }}>Independent verification decisions recorded against submitted milestone progress claims.</p>
      <ErrorBanner message={error} />

      <div className="grid mb-md" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {(["verified", "rejected", "request_clarification"] as const).map((k) => (
          <div key={k} className="card card-compact" style={{ borderLeft: `4px solid ${DECISION_META[k].color}` }}>
            <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 6, color: DECISION_META[k].color }}>
              {DECISION_META[k].icon}<span className="muted fs-xs">{DECISION_META[k].label}</span>
            </div>
            <div className="fw-700 fs-24">{counts[k] || 0}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input placeholder="Search milestone, verifier or note…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          </div>
          <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All decisions</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="request_clarification">Clarification requested</option>
          </select>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>Milestone</th><th>Decision</th><th>Verifier</th><th>Note</th><th>Date</th></tr></thead>
            <tbody>
              {filtered.map((r) => {
                const meta = DECISION_META[r.decision] ?? DECISION_META.verified;
                return (
                  <tr key={r.id}>
                    <td className="mono">{r.milestone_name || r.milestone_entry}</td>
                    <td><span className="badge" style={{ background: meta.color, display: "inline-flex", alignItems: "center", gap: 4 }}>{meta.icon}{meta.label}</span></td>
                    <td style={{ fontSize: 12 }}>{r.verifier_name || "—"}</td>
                    <td style={{ fontSize: 12 }}>{r.note || "—"}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.verified_at ? new Date(r.verified_at).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={5} className="empty">No verification decisions recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
