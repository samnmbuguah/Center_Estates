import { BadgeDollarSign, CheckCircle2, Clock3, Download, Plus, User, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get, patch, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { useWorkspace } from "../context/WorkspaceContext";

function money(v: number | string) {
  return `KES ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: `${color}20`, color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 13, fontWeight: 800,
    }}>{initials}</div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b",  label: "Pending" },
  approved: { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6",  label: "Approved" },
  paid:     { bg: "rgba(16,185,129,0.1)",  color: "#10b981",  label: "Paid" },
  void:     { bg: "rgba(239,68,68,0.1)",   color: "#ef4444",  label: "Void" },
};

export function ConsultantPayments() {
  const { id } = useParams();
  const { activeProjectId } = useWorkspace();
  const projectId = id || activeProjectId;
  const { can } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const emptyForm = { consultant_name: "", consultant_role: "architect", certificate_number: "", approved_fee: "", amount: "", retention_percent: "0", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    get<any[]>(`/projects/${projectId}/consultant-payments`).then(setPayments).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const submit = () => {
    if (!form.consultant_name.trim() || (!form.approved_fee && !form.amount)) { setError("Consultant name and approved fee are required"); return; }
    setError(null);
    post(`/projects/${id}/consultant-payments`, form).then(() => {
      setForm(emptyForm); setShowForm(false); load();
    }).catch(e => setError(e.message));
  };

  const action = (paymentId: number, a: string) => {
    setError(null);
    patch(`/consultant-payments/${paymentId}/action`, { action: a }).then(load).catch(e => setError(e.message));
  };

  /** Per-consultant report rows */
  const summary = useMemo(() => {
    const byName = new Map<string, { name: string; role: string; approved: number; paid: number; pending: number }>();
    payments.forEach(p => {
      const row = byName.get(p.consultant_name) || { name: p.consultant_name, role: p.consultant_role, approved: 0, paid: 0, pending: 0 };
      row.approved = Math.max(row.approved, Number(p.approved_fee || 0));
      if (p.status === "paid") row.paid += Number(p.amount || 0);
      if (["pending", "approved"].includes(p.status)) row.pending += Number(p.amount || 0);
      byName.set(p.consultant_name, row);
    });
    return [...byName.values()];
  }, [payments]);

  const approvedTotal = summary.reduce((s, r) => s + r.approved, 0);
  const paidTotal = summary.reduce((s, r) => s + r.paid, 0);
  const exportCsv = () => {
    const rows = [["Consultant", "Role", "Certificate", "Amount", "Retention %", "Status", "Notes"], ...payments.map(p => [p.consultant_name, p.consultant_role, p.certificate_number, p.amount, p.retention_percent, p.status, p.notes || ""] )];
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `consultant-payments-${projectId || "project"}.csv`; a.click();
  };
  const outstandingTotal = Math.max(approvedTotal - paidTotal, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Consultant Payment Tracker</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Approved fees, payments made, and outstanding balances for architects, engineers, QS, and other consultants
          </p>
        </div>
        <button className="btn ghost" onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}><Download size={15} /> Export CSV</button>
        {can("finance.admin") && (
          <button className="btn primary" onClick={() => setShowForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Plus size={16} /> Record Payment
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: BadgeDollarSign, label: "Total Approved Fees", value: money(approvedTotal), sub: `${summary.length} consultants`, color: "#3b82f6" },
          { icon: CheckCircle2, label: "Total Paid", value: money(paidTotal), sub: "Confirmed disbursements", color: "#10b981" },
          { icon: Clock3, label: "Pending Approval", value: money(summary.reduce((s, r) => s + r.pending, 0)), sub: "Submitted payments", color: "#f59e0b" },
          { icon: Wallet, label: "Outstanding Balance", value: money(outstandingTotal), sub: "Against approved fees", color: "#ef4444" },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: "16px 20px", borderRadius: 12, background: "var(--surface)",
            border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <kpi.icon size={18} style={{ color: kpi.color, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{kpi.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} />

      {/* New Payment Form */}
      {showForm && can("finance.admin") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Record Consultant Payment</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Consultant Name *</label>
              <input value={form.consultant_name} onChange={e => setForm({ ...form, consultant_name: e.target.value })} placeholder="e.g. Arch. Jane Doe" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Role</label>
              <select value={form.consultant_role} onChange={e => setForm({ ...form, consultant_role: e.target.value })}>
                <option value="architect">Architect</option>
                <option value="structural_engineer">Structural Engineer</option>
                <option value="mep_engineer">MEP Engineer</option>
                <option value="qs">Quantity Surveyor</option>
                <option value="project_manager">Project Manager</option>
                <option value="clerk_of_works">Clerk of Works</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Certificate / Reference No.</label>
              <input value={form.certificate_number} onChange={e => setForm({ ...form, certificate_number: e.target.value })} placeholder="CONS-001" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Approved Fee (KES) *</label>
              <input type="number" value={form.approved_fee} onChange={e => setForm({ ...form, approved_fee: e.target.value })} placeholder="Total approved fee" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Payment Amount (KES)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0 — setup only" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Retention %</label>
              <input type="number" step="0.01" max="100" value={form.retention_percent} onChange={e => setForm({ ...form, retention_percent: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Payment Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. 75% design completion payment…" rows={2} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={submit}>Create Payment Record</button>
          </div>
        </div>
      )}

      {/* Consultant Fee Summary Report */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <User size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Consultant Fee Summary</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>Approved fee · Amount paid · Outstanding balance</span>
        </div>
        {summary.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            <Wallet size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
            No consultant payments recorded. Click "Record Payment" above to add the first entry.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["Consultant", "Role", "Approved Fee", "Total Paid", "Outstanding Balance", "Progress"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((r, i) => {
                const outstanding = Math.max(r.approved - r.paid, 0);
                const paidPct = r.approved > 0 ? Math.min((r.paid / r.approved) * 100, 100) : 0;
                return (
                  <tr key={r.name} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={r.name} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                      {r.role?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{money(r.approved)}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 14, color: "#10b981", fontWeight: 700 }}>{money(r.paid)}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 14, color: outstanding > 0 ? "#ef4444" : "#10b981", fontWeight: 800 }}>
                      {money(outstanding)}
                    </td>
                    <td style={{ padding: "12px 16px", minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{paidPct.toFixed(0)}% paid</div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${paidPct}%`, background: paidPct === 100 ? "#10b981" : "#3b82f6", borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--surface-2)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "12px 16px", fontWeight: 800 }}>TOTAL</td>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 800 }}>{money(approvedTotal)}</td>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 800, color: "#10b981" }}>{money(paidTotal)}</td>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 800, color: outstandingTotal > 0 ? "#ef4444" : "#10b981" }}>{money(outstandingTotal)}</td>
                <td style={{ padding: "12px 16px" }}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Payment Ledger */}
      {!loading && payments.length > 0 && (
        <details style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <summary style={{
            padding: "14px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14,
            display: "flex", alignItems: "center", gap: 8, listStyle: "none",
            background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
          }}>
            <BadgeDollarSign size={15} style={{ color: "var(--primary)" }} />
            Payment Ledger
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{payments.length} entries</span>
          </summary>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  {["Consultant", "Role", "Certificate No.", "Amount", "Retention", "Status", "Notes", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => {
                  const ss = STATUS_STYLES[p.status] ?? STATUS_STYLES["pending"]!;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13 }}>{p.consultant_name}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>{p.consultant_role}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: "var(--primary)" }}>{p.certificate_number || "—"}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{money(p.amount)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>{p.retention_percent}%</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: ss.bg, color: ss.color }}>{ss.label}</span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)", maxWidth: 180 }}>{p.notes || "—"}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {p.status === "pending" && can("finance.admin") && (
                            <>
                              <button className="btn sm" onClick={() => action(p.id, "approve")} style={{ background: "#3b82f6", borderColor: "#3b82f6", color: "white", fontSize: 11 }}>Approve</button>
                              <button className="btn ghost sm" onClick={() => action(p.id, "void")} style={{ fontSize: 11 }}>Void</button>
                            </>
                          )}
                          {p.status === "approved" && can("finance.admin") && (
                            <button className="btn sm" onClick={() => action(p.id, "pay")} style={{ background: "#10b981", borderColor: "#10b981", color: "white", fontSize: 11 }}>Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
