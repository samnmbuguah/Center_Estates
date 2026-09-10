import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { AlertCircle, ArrowDownRight, CheckCircle2, HandCoins, Plus, X } from "lucide-react";

import { get, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";

function money(v: number | string) {
  return `KES ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--color-blue)",
  fully_recovered: "var(--color-emerald)",
  defaulted: "var(--color-danger)",
};

export function AdvancePayments() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contractor_name: "", amount: "", recovery_rate: "10", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recovery, setRecovery] = useState<{ advanceId: number | null; amount: string; certNumber: string }>({ advanceId: null, amount: "", certNumber: "" });

  const load = () => get<any[]>(`/projects/${id}/advance-payments`).then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.contractor_name.trim()) errs.contractor_name = "Required";
    if (!form.amount) errs.amount = "Required";
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = "Must be positive";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setLoading(true); setError(null);
    post(`/projects/${id}/advance-payments`, form).then(() => {
      setForm({ contractor_name: "", amount: "", recovery_rate: "10", notes: "" });
      setFieldErrors({}); setShowForm(false); load();
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  const recordRecovery = (advanceId: number) => {
    if (!recovery.amount) return;
    post(`/advance-payments/${advanceId}/recovery`, { amount_recovered: recovery.amount, certificate_number: recovery.certNumber })
      .then(() => { setRecovery({ advanceId: null, amount: "", certNumber: "" }); load(); })
      .catch(e => setError(e.message));
  };

  // KPI aggregates
  const totalAdvanced = items.reduce((s, ap) => s + Number(ap.amount || 0), 0);
  const totalRecovered = items.reduce((s, ap) => s + Number(ap.recovered_amount || 0), 0);
  const totalOutstanding = Math.max(totalAdvanced - totalRecovered, 0);
  const activeCount = items.filter(ap => ap.status === "active").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Advance Payment Register</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Mobilisation advances issued to contractors, with automatic recovery tracking against IPC certificates
          </p>
        </div>
        {can("finance.admin") && (
          <button className="btn primary" onClick={() => setShowForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Plus size={16} /> New Advance
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: HandCoins, label: "Total Advanced", value: money(totalAdvanced), sub: `${items.length} advances`, color: "var(--color-blue)" },
          { icon: ArrowDownRight, label: "Total Recovered", value: money(totalRecovered), sub: "Via IPC deductions", color: "var(--color-emerald)" },
          { icon: AlertCircle, label: "Outstanding Balance", value: money(totalOutstanding), sub: `${activeCount} active advances`, color: totalOutstanding > 0 ? "var(--color-amber)" : "var(--color-emerald)" },
          { icon: CheckCircle2, label: "Recovery Rate", value: totalAdvanced > 0 ? `${((totalRecovered / totalAdvanced) * 100).toFixed(0)}%` : "0%", sub: "Overall recovery", color: "var(--color-violet-strong)" },
        ].map(k => (
          <div key={k.label} style={{
            padding: "16px 20px", borderRadius: 12, background: "var(--surface)",
            border: "1px solid var(--border)", borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <k.icon size={18} style={{ color: k.color, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} />

      {/* New Advance Form */}
      {showForm && can("finance.admin") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New Advance Payment</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <FormField label="Contractor Name" required error={fieldErrors.contractor_name}>
              <input value={form.contractor_name} onChange={e => { setForm({ ...form, contractor_name: e.target.value }); setFieldErrors(f => ({ ...f, contractor_name: "" })); }}
                disabled={loading} placeholder="e.g. ABC Construction Ltd" />
            </FormField>
            <FormField label="Advance Amount (KES)" required error={fieldErrors.amount}>
              <input type="number" step="0.01" value={form.amount} onChange={e => { setForm({ ...form, amount: e.target.value }); setFieldErrors(f => ({ ...f, amount: "" })); }}
                disabled={loading} />
            </FormField>
            <FormField label="Recovery Rate (%)">
              <input type="number" step="0.1" min="0" max="100" value={form.recovery_rate} onChange={e => setForm({ ...form, recovery_rate: e.target.value })} disabled={loading} />
            </FormField>
            <FormField label="Notes">
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} disabled={loading} placeholder="Mobilisation purpose…" />
            </FormField>
          </div>
          <SubmitButton onClick={submit} loading={loading} disabled={loading} style={{ marginTop: 12 }}>Create Advance</SubmitButton>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
          <HandCoins size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Advance Register</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Contractor", "Advance Amount", "Recovery Rate", "Recovered", "Outstanding", "Progress", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((ap, i) => {
              const outstanding = Math.max(Number(ap.amount) - Number(ap.recovered_amount), 0);
              const recoveredPct = Number(ap.amount) > 0 ? Math.min((Number(ap.recovered_amount) / Number(ap.amount)) * 100, 100) : 0;
              const color = STATUS_COLORS[ap.status] || "var(--muted)";
              return (
                <tr key={ap.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>{ap.contractor_name}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{money(ap.amount)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{ap.recovery_rate}%</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 14, color: "var(--color-emerald)", fontWeight: 700 }}>{money(ap.recovered_amount)}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: outstanding > 0 ? "var(--color-amber)" : "var(--color-emerald)" }}>{money(outstanding)}</td>
                  <td style={{ padding: "12px 16px", minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{recoveredPct.toFixed(0)}%</div>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${recoveredPct}%`, background: recoveredPct >= 100 ? "var(--color-emerald)" : "var(--color-blue)", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: `color-mix(in srgb, ${color} 9%, transparent)`, color }}>
                      {ap.status === "fully_recovered" ? "Recovered" : ap.status.charAt(0).toUpperCase() + ap.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {can("finance.admin") && ap.status === "active" && (
                      recovery.advanceId === ap.id ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input type="number" step="0.01" placeholder="Amount" value={recovery.amount}
                            onChange={e => setRecovery({ ...recovery, amount: e.target.value })} style={{ width: 90, fontSize: 12 }} />
                          <input placeholder="Cert #" value={recovery.certNumber}
                            onChange={e => setRecovery({ ...recovery, certNumber: e.target.value })} style={{ width: 70, fontSize: 12 }} />
                          <button className="btn sm" onClick={() => recordRecovery(ap.id)} style={{ fontSize: 11 }}>Record</button>
                          <button className="btn ghost sm" onClick={() => setRecovery({ advanceId: null, amount: "", certNumber: "" })} style={{ padding: "4px 6px" }}><X size={12} /></button>
                        </div>
                      ) : (
                        <button className="btn ghost sm" onClick={() => setRecovery({ ...recovery, advanceId: ap.id })} style={{ fontSize: 11 }}>Record Recovery</button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  <HandCoins size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
                  No advance payments recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
