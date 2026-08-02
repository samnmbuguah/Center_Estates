import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, HandCoins, XCircle, Plus } from "lucide-react";
import { fetchDrawdownRequests, createDrawdownRequest, actionDrawdownRequest, type DrawdownRequest } from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { ErrorBanner } from "../components";
import { money } from "../lib/format";
import { StatusPill, PageLoading } from "../components/PageState";
import { useToast } from "../hooks/useToast";

const actions: Record<string, { label: string; action: string; icon: any; tone?: "danger" | "success" }[]> = {
  submitted: [{ label: "Start document review", action: "review_documents", icon: FileCheck2 }],
  document_review: [{ label: "Send to valuation", action: "review_valuation", icon: FileCheck2 }],
  valuation_review: [
    { label: "Approve", action: "approve", icon: CheckCircle2, tone: "success" },
    { label: "Reject", action: "reject", icon: XCircle, tone: "danger" },
  ],
  approved: [{ label: "Mark disbursed", action: "disburse", icon: HandCoins, tone: "success" }],
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved" || status === "disbursed") return "success";
  if (status === "rejected") return "danger";
  if (status === "submitted") return "warning";
  return "info";
}

export function DrawdownRequests() {
  const { activeProjectId, activeProject, projects, selectProject } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState<DrawdownRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ request_number: "", amount: "", purpose: "" });

  const load = useCallback(() => {
    if (!activeProjectId) { setItems([]); return; }
    setLoading(true);
    fetchDrawdownRequests(activeProjectId)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!activeProjectId) { setError("Select a project first."); return; }
    if (!form.request_number || !form.amount || !form.purpose) {
      setError("Request number, amount and purpose are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createDrawdownRequest({ ...form, project_id: activeProjectId });
      setForm({ request_number: "", amount: "", purpose: "" });
      toast.success("Drawdown request submitted");
      load();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (id: number, name: string) => {
    setBusy(true);
    setError(null);
    try {
      await actionDrawdownRequest(id, name);
      toast.success(`Drawdown ${name.replaceAll("_", " ")} completed`);
      load();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (!activeProjectId) {
    return (
      <div>
        <div className="page-head">
          <div className="eyebrow">Financial monitoring</div>
          <h2>Funding Drawdown Requests</h2>
          <p className="muted">Select a project to submit and review funding requests.</p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Project</label>
          <select
            style={{ display: "block", marginTop: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", minWidth: 280 }}
            value=""
            onChange={(e) => e.target.value && selectProject(e.target.value)}
          >
            <option value="">Choose project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-head">
        <div className="eyebrow">Financial monitoring</div>
          <h2>Funding Drawdown Requests</h2>
        <p className="muted">
          Release approved project financing for <strong>{activeProject?.name || activeProjectId}</strong>. This is separate from contingency use and advance recovery.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}><Plus size={16} /> New drawdown request</h3>
        <div style={{ display: "grid", gridTemplateColumns: "160px 160px 1fr auto", gap: 10, alignItems: "end" }}>
          <div className="field">
            <label>Request number</label>
            <input placeholder="DRW-001" value={form.request_number} onChange={(e) => setForm({ ...form, request_number: e.target.value })} />
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="field">
            <label>Purpose / justification</label>
            <input placeholder="Why is this drawdown required?" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <button className="btn primary" onClick={create} disabled={busy}>Submit request</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}><PageLoading rows={1} /></div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "12px 14px" }}>Request</th>
                <th style={{ padding: "12px 14px" }}>Amount</th>
                <th style={{ padding: "12px 14px" }}>Purpose</th>
                <th style={{ padding: "12px 14px" }}>Status</th>
                <th style={{ padding: "12px 14px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }} className="mono">{item.request_number}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{money(item.amount)}</td>
                  <td style={{ padding: "12px 14px" }}>{item.purpose}</td>
                  <td style={{ padding: "12px 14px" }}><StatusPill label={item.status.replaceAll("_", " ")} tone={statusTone(item.status)} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(actions[item.status] || []).map(({ label, action: name, icon: Icon }) => (
                        <button className="btn ghost sm" key={name} disabled={busy} onClick={() => runAction(item.id, name)}>
                          <Icon size={14} style={{ marginRight: 4 }} />{label}
                        </button>
                      ))}
                      {!(actions[item.status] || []).length && <span className="muted">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                  No drawdown requests for this project yet.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
