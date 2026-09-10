import { useParams } from "@/components/monitoring/react-router-shim";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Download,
  Calendar, DollarSign, Activity, BarChart3, FileText,
} from "lucide-react";

function money(v: number) {
  if (v >= 1e9) return `KSh ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `KSh ${(v / 1e6).toFixed(1)}M`;
  return `KSh ${v.toLocaleString()}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

const CASH_FLOW_DATA = [
  { month: "Jan", inflow: 45, outflow: 38, net: 7, cumInflow: 45, cumOutflow: 38 },
  { month: "Feb", inflow: 52, outflow: 44, net: 8, cumInflow: 97, cumOutflow: 82 },
  { month: "Mar", inflow: 48, outflow: 51, net: -3, cumInflow: 145, cumOutflow: 133 },
  { month: "Apr", inflow: 62, outflow: 55, net: 7, cumInflow: 207, cumOutflow: 188 },
  { month: "May", inflow: 58, outflow: 60, net: -2, cumInflow: 265, cumOutflow: 248 },
  { month: "Jun", inflow: 71, outflow: 63, net: 8, cumInflow: 336, cumOutflow: 311 },
  { month: "Jul", inflow: 85, outflow: 72, net: 13, cumInflow: 421, cumOutflow: 383 },
  { month: "Aug", inflow: 0, outflow: 0, net: 0, cumInflow: 0, cumOutflow: 0 },
  { month: "Sep", inflow: 0, outflow: 0, net: 0, cumInflow: 0, cumOutflow: 0 },
  { month: "Oct", inflow: 0, outflow: 0, net: 0, cumInflow: 0, cumOutflow: 0 },
  { month: "Nov", inflow: 0, outflow: 0, net: 0, cumInflow: 0, cumOutflow: 0 },
];

const TRANSACTIONS = [
  { date: "18 Jul 2026", description: "IPC No. 12 Payment Received", category: "Certificate Payment", type: "inflow", amount: 45900000, balance: 421000000 },
  { date: "17 Jul 2026", description: "Subcontractor Payment – MEP Works", category: "Contractor Payment", type: "outflow", amount: 12500000, balance: 375100000 },
  { date: "15 Jul 2026", description: "IPC No. 11 Payment Received", category: "Certificate Payment", type: "inflow", amount: 43350000, balance: 387600000 },
  { date: "14 Jul 2026", description: "Materials Purchase – Rebar", category: "Materials", type: "outflow", amount: 8200000, balance: 344250000 },
  { date: "12 Jul 2026", description: "Mobilisation Advance Recovery", category: "Advance Recovery", type: "inflow", amount: 5400000, balance: 352450000 },
  { date: "10 Jul 2026", description: "Labour Cost – Structural Works", category: "Labour", type: "outflow", amount: 15600000, balance: 347050000 },
  { date: "08 Jul 2026", description: "Contingency Drawdown Approved", category: "Contingency", type: "inflow", amount: 2500000, balance: 362650000 },
  { date: "05 Jul 2026", description: "Consultant Fee – Structplan Ltd", category: "Consultant Fees", type: "outflow", amount: 3200000, balance: 360150000 },
];

const FORECAST = [
  { month: "Aug 2026", expectedInflow: 78, expectedOutflow: 65, net: 13 },
  { month: "Sep 2026", expectedInflow: 82, expectedOutflow: 71, net: 11 },
  { month: "Oct 2026", expectedInflow: 90, expectedOutflow: 78, net: 12 },
];

export function CashFlow() {
  const { id = "default" } = useParams();
  const maxBar = 90;

  const totalInflow = CASH_FLOW_DATA.reduce((s, d) => s + d.inflow, 0);
  const totalOutflow = CASH_FLOW_DATA.reduce((s, d) => s + d.outflow, 0);
  const netPosition = totalInflow - totalOutflow;
  const currentBalance = 421000000;
  const exportCsv = () => {
    const csv = [["Date", "Description", "Category", "Type", "Amount", "Running Balance"], ...TRANSACTIONS.map(t => [t.date, t.description, t.category, t.type, t.amount, t.balance])]
      .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `cash-flow-${id}.csv`; a.click();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Financial Monitoring</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Cash Flow Register</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Certificate inflows, contractor outflows, and net cash position over time
          </p>
        </div>
        <button className="btn" onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={15} /> Export Report
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: TrendingUp, label: "Total Inflows (YTD)", value: money(totalInflow * 1e6), sub: "Certificates + recoveries", color: "var(--color-emerald)" },
          { icon: TrendingDown, label: "Total Outflows (YTD)", value: money(totalOutflow * 1e6), sub: "Contractors + materials", color: "var(--color-danger)" },
          { icon: Activity, label: "Net Position (YTD)", value: money(netPosition * 1e6), sub: netPosition >= 0 ? "Positive flow" : "Cash deficit", color: netPosition >= 0 ? "var(--color-emerald)" : "var(--color-danger)" },
          { icon: DollarSign, label: "Current Balance", value: money(currentBalance), sub: "As at 18 Jul 2026", color: "var(--color-blue)" },
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Cash Flow Bar Chart */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Monthly Cash Flow</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Inflows vs Outflows (KSh Millions)</div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-emerald)" }} /> Inflow</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-danger)" }} /> Outflow</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-blue)" }} /> Net</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 200, paddingBottom: 24, position: "relative" }}>
            {CASH_FLOW_DATA.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end" }}>
                {d.inflow > 0 ? (
                  <>
                    <div style={{ flex: 1, height: `${(d.inflow / maxBar) * 100}%`, background: "var(--color-emerald)", borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`Inflow: KSh ${d.inflow}M`} />
                    <div style={{ flex: 1, height: `${(d.outflow / maxBar) * 100}%`, background: "var(--color-danger)", borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`Outflow: KSh ${d.outflow}M`} />
                  </>
                ) : (
                  <div style={{ flex: 2, height: 4, background: "var(--surface-3)", borderRadius: 2, opacity: 0.4 }} />
                )}
              </div>
            ))}
            {/* X-axis labels */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", gap: 8 }}>
              {CASH_FLOW_DATA.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{d.month}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash Flow Forecast */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 20px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>3-Month Forecast</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Expected inflows & outflows</div>
          {FORECAST.map((f, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <span>{f.month}</span>
                <span style={{ color: f.net >= 0 ? "var(--color-emerald)" : "var(--color-danger)" }}>Net: KSh {f.net}M</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Inflow: KSh {f.expectedInflow}M</div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ width: `${(f.expectedInflow / 100) * 100}%`, height: "100%", background: "var(--color-emerald)", borderRadius: 3 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Outflow: KSh {f.expectedOutflow}M</div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ width: `${(f.expectedOutflow / 100) * 100}%`, height: "100%", background: "var(--color-danger)", borderRadius: 3 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Ledger */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={15} style={{ color: "var(--primary)" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Transaction Ledger</span>
          </div>
          <button className="btn ghost sm" onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <FileText size={13} /> Export
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Date", "Description", "Category", "Type", "Amount", "Running Balance"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRANSACTIONS.map((t, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                <td style={{ padding: "11px 16px", fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600 }}>{t.description}</td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--surface-3)", color: "var(--muted)", fontWeight: 600 }}>{t.category}</span>
                </td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: t.type === "inflow" ? "var(--color-emerald)" : "var(--color-danger)" }}>
                    {t.type === "inflow" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {t.type === "inflow" ? "Inflow" : "Outflow"}
                  </span>
                </td>
                <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: t.type === "inflow" ? "var(--color-emerald)" : "var(--color-danger)" }}>
                  {t.type === "inflow" ? "+" : "-"}{money(t.amount)}
                </td>
                <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 13 }}>{money(t.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
