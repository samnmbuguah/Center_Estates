import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { fetchBimDiscrepancies, resolveBimDiscrepancy } from "../api";
import { useAuth } from "../auth";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components";

const severityColor: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--danger)",
};

export function BimDiscrepancies() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const load = () => fetchBimDiscrepancies(id).then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const handleResolve = () => {
    if (!resolveTarget) return;
    setError(null);
    resolveBimDiscrepancy(id, resolveTarget.id, resolutionNotes)
      .then(() => { setResolveTarget(null); setResolutionNotes(""); load(); })
      .catch(e => setError(e.message));
  };

  return (
    <div>
      <h2>BIM Discrepancies</h2>
      <ErrorBanner message={error} />

      <div className="table-wrap">
        <div className="card">
          <table>
            <thead><tr>
              <th>ID</th><th>Milestone</th><th>Type / Element</th><th>Description</th><th>Severity</th><th>Confidence</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td>{d.milestone_title || d.milestone_id || "—"}</td>
                  <td>{d.element_type || d.discrepancy_type || "—"}</td>
                  <td>{d.description || "—"}</td>
                  <td>
                    <span className="badge" style={{ background: severityColor[d.severity] ?? "var(--faint)" }}>
                      {d.severity || "unknown"}
                    </span>
                  </td>
                  <td>{d.confidence_score != null ? `${Math.round(d.confidence_score * 100)}%` : "—"}</td>
                  <td>
                    <span className="badge" style={{ background: d.status === "resolved" ? "var(--success)" : d.status === "open" ? "var(--warning)" : "var(--faint)" }}>
                      {d.status || "open"}
                    </span>
                  </td>
                  <td>
                    {can("bim.view") && d.status === "open" && (
                      <button className="btn ghost sm" onClick={() => { setResolveTarget(d); setResolutionNotes(""); }}>Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState title="No BIM discrepancies" description="No discrepancies found for this project." />}
        </div>
      </div>

      {resolveTarget && (
        <div className="modal-overlay" onClick={() => setResolveTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>Resolve Discrepancy #{resolveTarget.id}</h3>
            <p className="muted" style={{ marginBottom: 12 }}>{resolveTarget.description}</p>
            <div className="field">
              <label>Resolution Notes</label>
              <textarea
                rows={4} value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Describe how this discrepancy was resolved..."
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setResolveTarget(null)}>Cancel</button>
              <button className="btn" onClick={handleResolve} disabled={!resolutionNotes.trim()}>Resolve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
