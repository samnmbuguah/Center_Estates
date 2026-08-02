import { useEffect, useRef, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { AlertCircle, CheckCircle2, ChevronDown, Download, PiggyBank, Plus, Umbrella, Upload, X } from "lucide-react";

import { API_BASE, get, patch, post, authHeaders } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";
import { useWorkspace } from "../context/WorkspaceContext";

function money(v: number | string) {
  return `KES ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  requested: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
};

const CAT_LABELS: Record<string, string> = {
  design_development: "Design Development",
  unforeseen: "Unforeseen",
  escalation: "Price Escalation",
  client_instruction: "Client Instruction",
  other: "Other",
};

export function ContingencyDrawdowns() {
  const { id } = useParams();
  const { activeProjectId } = useWorkspace();
  const projectId = id || activeProjectId;
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ drawdown_number: "", reason: "", category: "unforeseen", amount: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Excel upload
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const load = () => {
    setError(null);
    get<any[]>(`/projects/${projectId}/contingency-drawdowns`)
      .then(data => { setItems(data); if (data.length > 0) setLocked(true); })
      .catch(e => setError(e.message));
  };
  useEffect(() => { if (projectId) load(); }, [projectId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.drawdown_number.trim()) errs.drawdown_number = "Required";
    if (!form.reason.trim()) errs.reason = "Required";
    if (!form.amount) errs.amount = "Required";
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = "Must be positive";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setLoading(true); setError(null);
    post(`/projects/${id}/contingency-drawdowns`, form).then(() => {
      setForm({ drawdown_number: "", reason: "", category: "unforeseen", amount: "" });
      setFieldErrors({}); setShowForm(false); load();
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  const action = (cdId: number, act: string) => {
    patch(`/contingency-drawdowns/${cdId}/action`, { action: act }).then(load).catch(e => setError(e.message));
  };

  const handleFile = async (f: File) => {
    setUploadMsg(null); setError(null);
    const fd = new FormData();
    fd.append("file", f);
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/projects/${id}/ingest/cost-preview`, {
        method: "POST", headers: { ...authHeaders() }, body: fd,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Preview failed"); }
      const r = await res.json();
      setPreview(r.contingency_items || []);
      if (!r.contingency_items?.length) {
        setUploadMsg("No contingency items found in file. Check that the sheet is named 'Contingency Drawdowns'.");
      }
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const commitPreview = async () => {
    if (!preview) return;
    setUploadMsg(null); setError(null);
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/projects/${id}/ingest/cost-commit`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ contingency_items: preview }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "Commit failed");
      setUploadMsg(`Committed ${r.contingency_items} drawdowns.`);
      setPreview(null); load();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  // Compute summary from items (derive allowance from first item's eligibility)
  const eligibility = items[0]?.eligibility || {};
  const allowance = Number(eligibility.allowance || 0);
  const approvedDrawn = Number(eligibility.approved_drawn || 0);
  const available = Number(eligibility.available || allowance);
  const utilPct = allowance > 0 ? Math.min((approvedDrawn / allowance) * 100, 100) : 0;

  const approved = items.filter(i => i.status === "approved").reduce((s, i) => s + Number(i.amount), 0);
  const pending = items.filter(i => i.status === "requested").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Contingency Register</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Budget allocation and drawdown requests against the project contingency allowance</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {can("finance.admin") && !locked && (
            <button className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Upload size={14} /> Bulk Upload
            </button>
          )}
          {can("finance.admin") && (
            <button className="btn primary" onClick={() => setShowForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={16} /> New Drawdown
            </button>
          )}
        </div>
      </div>

      <input type="file" accept=".xlsx,.xls" ref={fileRef} style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {/* Budget vs Spend KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
        {/* Utilisation meter */}
        <div style={{
          padding: "20px 24px", borderRadius: 12, background: "var(--surface)",
          border: "1px solid var(--border)", borderTop: "3px solid #8b5cf6",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <PiggyBank size={16} style={{ color: "#8b5cf6" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Budget Utilisation</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: utilPct > 80 ? "#ef4444" : utilPct > 60 ? "#f59e0b" : "#8b5cf6", marginBottom: 8 }}>
            {utilPct.toFixed(0)}%
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${utilPct}%`,
              background: utilPct > 80 ? "#ef4444" : utilPct > 60 ? "#f59e0b" : "linear-gradient(90deg,#8b5cf6,#a78bfa)",
              transition: "width 0.4s",
            }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {money(approvedDrawn)} spent of {allowance > 0 ? money(allowance) : "—"} allowance
          </div>
        </div>

        {/* 3 KPI columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Contingency Budget", value: allowance > 0 ? money(allowance) : "Not set", sub: "Configured allowance", color: "#3b82f6" },
            { label: "Approved Drawn", value: money(approved), sub: `${items.filter(i => i.status === "approved").length} drawdowns`, color: "#10b981" },
            { label: "Remaining Available", value: allowance > 0 ? money(available) : "—", sub: `${items.filter(i => i.status === "requested").length} pending (${money(pending)})`, color: available < 0 ? "#ef4444" : "#8b5cf6" },
          ].map(k => (
            <div key={k.label} style={{
              padding: "16px 18px", borderRadius: 12, background: "var(--surface)",
              border: "1px solid var(--border)", borderTop: `3px solid ${k.color}`,
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />

      {uploadMsg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 13, color: "#10b981", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={14} /> {uploadMsg}
        </div>
      )}

      {/* Template Download Links */}
      {can("finance.admin") && !locked && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, alignItems: "center" }}>
          <AlertCircle size={14} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Download the template first, then upload your completed file:</span>
          <a className="btn ghost sm" href={`${API_BASE}/templates/contingency`} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={13} /> Contingency Template
          </a>
          <a className="btn ghost sm" href={`${API_BASE}/templates/provisional-sums`} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={13} /> Provisional Sums Template
          </a>
        </div>
      )}

      {/* New Drawdown Form */}
      {showForm && can("finance.admin") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New Drawdown Request</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
            <FormField label="Drawdown No." required error={fieldErrors.drawdown_number}>
              <input value={form.drawdown_number} placeholder="CD-001"
                onChange={e => { setForm({ ...form, drawdown_number: e.target.value }); setFieldErrors(f => ({ ...f, drawdown_number: "" })); }}
                disabled={loading} autoFocus />
            </FormField>
            <FormField label="Category">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} disabled={loading}>
                <option value="design_development">Design Development</option>
                <option value="unforeseen">Unforeseen Condition</option>
                <option value="escalation">Price Escalation</option>
                <option value="client_instruction">Client Instruction</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Amount (KES)" required error={fieldErrors.amount}>
              <input type="number" step="0.01" value={form.amount}
                onChange={e => { setForm({ ...form, amount: e.target.value }); setFieldErrors(f => ({ ...f, amount: "" })); }}
                disabled={loading} />
            </FormField>
            <div style={{ gridColumn: "1 / -1" }}>
              <FormField label="Reason / Justification" required error={fieldErrors.reason}>
                <textarea value={form.reason} rows={2}
                  placeholder="Explain why this contingency drawdown is required…"
                  onChange={e => { setForm({ ...form, reason: e.target.value }); setFieldErrors(f => ({ ...f, reason: "" })); }}
                  disabled={loading} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
              </FormField>
            </div>
          </div>
          <SubmitButton onClick={submit} loading={loading} disabled={loading} style={{ marginTop: 8 }}>Submit Drawdown Request</SubmitButton>
        </div>
      )}

      {/* Upload preview */}
      {preview && preview.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Preview — {preview.length} items</div>
          <div style={{ maxHeight: 240, overflow: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ fontSize: 13, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "6px 10px" }}>No.</th>
                  <th style={{ padding: "6px 10px" }}>Reason</th>
                  <th style={{ padding: "6px 10px" }}>Category</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "4px 10px" }}>{c.drawdown_number}</td>
                    <td style={{ padding: "4px 10px" }}>{c.reason}</td>
                    <td style={{ padding: "4px 10px" }}>{CAT_LABELS[c.category] || c.category}</td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>{money(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn primary sm" onClick={commitPreview} disabled={uploading}>Commit</button>
            <button className="btn ghost sm" onClick={() => { setPreview(null); setUploadMsg(null); }}>Discard</button>
          </div>
        </div>
      )}

      {/* Drawdowns Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Umbrella size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Drawdown Register</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{items.length} records</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["No.", "Reason", "Category", "Amount", "Status", "Approved By", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((cd, i) => {
              const color = STATUS_COLORS[cd.status] || "var(--muted)";
              return (
                <tr key={cd.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{cd.drawdown_number}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, maxWidth: 240 }}>{cd.reason}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>{CAT_LABELS[cd.category] || cd.category}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{money(cd.amount)}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: `${color}18`, color }}>
                      {cd.status.charAt(0).toUpperCase() + cd.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>{cd.approved_by || "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {can("finance.admin") && cd.status === "requested" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn sm" onClick={() => action(cd.id, "approve")} style={{ background: "#10b981", borderColor: "#10b981", color: "white", fontSize: 11 }}>Approve</button>
                        <button className="btn ghost sm" onClick={() => action(cd.id, "reject")} style={{ fontSize: 11 }}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  <Umbrella size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
                  No contingency drawdowns recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
