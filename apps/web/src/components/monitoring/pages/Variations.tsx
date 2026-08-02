import { AlertCircle, ArrowUpDown, Check, CheckCircle2, ChevronLeft, ChevronRight, GitCompareArrows, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get, patch, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";
import { useWorkspace } from "../context/WorkspaceContext";
import { useSort } from "../hooks/useSort";

const TYPE_COLORS: Record<string, string> = {
  addition: "#10b981",
  omission: "#ef4444",
  administrative: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--muted)",
  submitted: "#3b82f6",
  approved: "#10b981",
  rejected: "#ef4444",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "var(--muted)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: `${color}18`, color,
    }}>
      {status === "approved" && <Check size={11} />}
      {status === "rejected" && <X size={11} />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function Variations() {
  const { id } = useParams();
  const { activeProjectId } = useWorkspace();
  const projectId = id || activeProjectId || "kasneb-towers-2";
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const emptyForm = { description: "", variation_type: "addition", target: "boq", quantity: "", unit: "", unit_rate: "", justification: "" };
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = () => get<any[]>(`/projects/${projectId}/variations`).then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, [projectId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = "Required";
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) errs.quantity = "Enter a positive quantity";
    if (!form.unit_rate || isNaN(Number(form.unit_rate)) || Number(form.unit_rate) < 0) errs.unit_rate = "Enter a valid rate";
    if (!form.justification.trim()) errs.justification = "Justification is required for the audit trail";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setLoading(true); setError(null);
    post(`/projects/${id}/variations`, form).then(() => {
      setForm(emptyForm); setFieldErrors({}); setShowForm(false); load();
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  const action = (variationId: number, act: string) => {
    patch(`/variations/${variationId}/action`, { action: act }).then(load).catch(e => setError(e.message));
  };

  const { sorted, sortKey, toggleSort } = useSort(items, "variation_number");
  const sortIcon = (key: string) => (
    <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: sortKey === key ? 1 : 0.3, verticalAlign: "middle", cursor: "pointer" }} />
  );

  // Aggregate totals
  const totalApproved = items.filter(v => v.status === "approved").reduce((s, v) => s + Number(v.amount || 0), 0);
  const totalPending = items.filter(v => v.status === "submitted").reduce((s, v) => s + Number(v.amount || 0), 0);
  const money = (v: number) => `KES ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Variations Register</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Contract change orders — BQ and Work Plan adjustments with full audit trail</p>
        </div>
        {can("finance.admin") && (
          <button className="btn primary" onClick={() => setShowForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> New Variation
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Variations", value: items.length.toString(), sub: "All statuses", color: "#3b82f6" },
          { label: "Approved Value", value: money(totalApproved), sub: `${items.filter(v => v.status === "approved").length} variations`, color: "#10b981" },
          { label: "Pending Approval", value: money(totalPending), sub: `${items.filter(v => v.status === "submitted").length} submitted`, color: "#f59e0b" },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: "16px 20px", borderRadius: 12, background: "var(--surface)",
            border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} />

      {/* New Variation Form */}
      {showForm && can("finance.admin") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New Variation</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, marginTop: -8 }}>
            The variation number is auto-generated. Original BoQ and work-plan baselines remain unchanged — variations are recorded as adjustments.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <FormField label="Description" required error={fieldErrors.description}>
                <input value={form.description} placeholder="Describe the variation work…"
                  onChange={e => { setForm({ ...form, description: e.target.value }); setFieldErrors(f => ({ ...f, description: "" })); }}
                  disabled={loading} style={{ width: "100%", boxSizing: "border-box" }} />
              </FormField>
            </div>
            <FormField label="Applies to">
              <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} disabled={loading}>
                <option value="boq">Bill of Quantities</option>
                <option value="work_plan">Work Plan</option>
              </select>
            </FormField>
            <FormField label="Variation Type">
              <select value={form.variation_type} onChange={e => setForm({ ...form, variation_type: e.target.value })} disabled={loading}>
                <option value="addition">Addition</option>
                <option value="omission">Omission</option>
                <option value="administrative">Administrative</option>
              </select>
            </FormField>
            <FormField label="Unit">
              <input placeholder="m², nr, item…" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} disabled={loading} />
            </FormField>
            <FormField label="Quantity" required error={fieldErrors.quantity}>
              <input type="number" step="0.001" value={form.quantity}
                onChange={e => { setForm({ ...form, quantity: e.target.value }); setFieldErrors(f => ({ ...f, quantity: "" })); }}
                disabled={loading} />
            </FormField>
            <FormField label="Unit Rate (KES)" required error={fieldErrors.unit_rate}>
              <input type="number" step="0.01" value={form.unit_rate}
                onChange={e => { setForm({ ...form, unit_rate: e.target.value }); setFieldErrors(f => ({ ...f, unit_rate: "" })); }}
                disabled={loading} />
            </FormField>
            <FormField label="Calculated Amount">
              <input value={`KES ${(Number(form.quantity || 0) * Number(form.unit_rate || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} readOnly
                style={{ background: "var(--surface-2)", fontWeight: 700 }} />
            </FormField>
            <div style={{ gridColumn: "1 / -1" }}>
              <FormField label="Justification / Reason" required error={fieldErrors.justification}>
                <textarea value={form.justification} rows={2}
                  placeholder="State why this variation is necessary (required for audit trail)…"
                  onChange={e => { setForm({ ...form, justification: e.target.value }); setFieldErrors(f => ({ ...f, justification: "" })); }}
                  disabled={loading} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
              </FormField>
            </div>
          </div>
          <SubmitButton onClick={submit} loading={loading} disabled={loading}>Create Variation</SubmitButton>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  {Object.entries({ variation_number: "No.", description: "Description", target: "Applies To", variation_type: "Type", quantity: "Qty", unit_rate: "Rate", amount: "Amount", status: "Status", approved_by: "Approved By" }).map(([key, label]) => (
                  <th key={key} onClick={() => toggleSort(key as any)} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {label}{sortIcon(key)}
                  </th>
                ))}
                <th style={{ padding: "10px 14px" }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{v.variation_number}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, maxWidth: 220 }}>
                    <div style={{ fontWeight: 500 }}>{v.description}</div>
                    {v.justification && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{v.justification.slice(0, 60)}{v.justification.length > 60 ? "…" : ""}</div>}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{v.target === "work_plan" ? "Work Plan" : "BoQ"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      background: `${TYPE_COLORS[v.variation_type] || "var(--muted)"}20`,
                      color: TYPE_COLORS[v.variation_type] || "var(--muted)",
                    }}>
                      {v.variation_type.charAt(0).toUpperCase() + v.variation_type.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.quantity ? `${v.quantity} ${v.unit || ""}`.trim() : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace" }}>{v.unit_rate ? Number(v.unit_rate).toLocaleString() : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{Number(v.amount).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px" }}><StatusBadge status={v.status} /></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{v.approved_by || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {can("finance.admin") && v.status === "draft" && (
                        <button className="btn ghost sm" onClick={() => action(v.id, "submit")}>Submit</button>
                      )}
                      {can("finance.admin") && v.status === "submitted" && (
                        <>
                          <button className="btn sm" onClick={() => action(v.id, "approve")} style={{ background: "#10b981", borderColor: "#10b981", color: "white" }}>Approve</button>
                          <button className="btn ghost sm" onClick={() => action(v.id, "reject")}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    <GitCompareArrows size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
                    No variations recorded. Click "New Variation" to add the first change order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
