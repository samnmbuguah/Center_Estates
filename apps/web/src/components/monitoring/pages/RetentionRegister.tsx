import { ArrowDownToLine, Building2, CheckCircle2, DollarSign, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get } from "../api";
import { ErrorBanner } from "../components";

function money(v: number | string) {
  return `KES ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function RetentionRegister() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    get<any>(`/finance/retention/summary?project_id=${id}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const contractors: any[] = data?.contractors || [];
  const certs: any[] = data?.certificates || [];

  const totalGross = Number(data?.total_gross || 0);
  const totalRetained = Number(data?.total_retained || 0);
  const retentionPct = totalGross > 0 ? ((totalRetained / totalGross) * 100).toFixed(1) : "0.0";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Retention Register</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Retention amounts held per contractor, auto-populated from payment certificates. No manual input required.
        </p>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          <Loader2 size={24} style={{ display: "block", margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
          Loading retention data…
        </div>
      ) : (
        <>
          {/* KPI summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            <div style={{ padding: "16px 20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", borderTop: "3px solid #3b82f6" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>Total Certified Gross</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{money(totalGross)}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{data?.certificate_count || 0} certificates</div>
            </div>
            <div style={{ padding: "16px 20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", borderTop: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>Total Retention Held</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{money(totalRetained)}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{retentionPct}% of gross certified</div>
            </div>
            <div style={{ padding: "16px 20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", borderTop: "3px solid #10b981" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>Contractors on Register</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{contractors.length}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Unique contractor entries</div>
            </div>
          </div>

          {/* Contractor Retention Summary */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={16} style={{ color: "var(--primary)" }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Retention per Contractor</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>Auto-populated from IPC certification</span>
            </div>

            {contractors.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                <ShieldCheck size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
                No retention records yet. Retention is tracked automatically once payment certificates are issued.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {["Contractor / Subcontractor", "Certificates", "Total Gross Certified", "Retention Held", "% Rate"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((c, i) => {
                    const pct = Number(c.total_gross) > 0 ? ((Number(c.retention_held) / Number(c.total_gross)) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={c.contractor_name} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%", background: "rgba(0,163,255,0.12)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 800, color: "var(--primary)", flexShrink: 0,
                            }}>
                              {c.contractor_name.charAt(0).toUpperCase()}
                            </div>
                            {c.contractor_name}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{c.certificate_count}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14, fontFamily: "monospace", fontWeight: 600 }}>{money(c.total_gross)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 800, color: "#f59e0b" }}>
                            {money(c.retention_held)}
                          </span>
                          <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: "var(--surface-3)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(parseFloat(pct) * 20, 100)}%`, background: "#f59e0b", borderRadius: 2 }} />
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface-2)", borderTop: "2px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14 }}>TOTAL</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{data?.certificate_count || 0}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 800 }}>{money(totalGross)}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 800, color: "#f59e0b" }}>{money(totalRetained)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{retentionPct}%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Certificate-level detail (collapsible) */}
          <details style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <summary style={{
              padding: "14px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14,
              display: "flex", alignItems: "center", gap: 8, listStyle: "none",
              background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
            }}>
              <CheckCircle2 size={16} style={{ color: "var(--primary)" }} />
              Certificate-Level Breakdown
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{certs.length} certificates</span>
            </summary>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {["IPC No.", "Contractor", "Gross Certified", "Retention Held", "Net Payable", "Issue Date"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{c.number}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>{c.contractor_name}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "monospace" }}>{money(c.gross)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "monospace", color: "#f59e0b", fontWeight: 700 }}>{money(c.retention_amount)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "monospace" }}>{money(c.net_payable)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>
                        {c.issued_at ? new Date(c.issued_at * 1000).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {certs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No certificates issued yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
