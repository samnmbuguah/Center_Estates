import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import { get, post } from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  AlertTriangle, ShieldAlert, Filter, Plus, CheckCircle2, Clock, UserCheck,
  ChevronRight, Ticket, AlertCircle, FileText, ArrowUpRight, Shield, Download,
  TrendingDown, TrendingUp, BarChart3, Eye, FileSpreadsheet, RefreshCw
} from "lucide-react";

const SUB_TABS = [
  { id: "overview", label: "Risk Overview" },
  { id: "register", label: "Risk Register" },
  { id: "category", label: "Risk Category" },
  { id: "matrix", label: "Risk Matrix" },
  { id: "reports", label: "Risk Reports" },
];

function scoreColor(score: number): string {
  if (score >= 15) return "#ef4444";
  if (score >= 8) return "#f59e0b";
  return "#10b981";
}

/** Build a live 5×5 matrix from register likelihood × impact (open risks only by default). */
function buildMatrixCells(register: any[], openOnly = true) {
  const cells: { row: number; col: number; val: number; color: string; risks: any[] }[] = [];
  for (let row = 5; row >= 1; row--) {
    for (let col = 1; col <= 5; col++) {
      const risks = register.filter((r) => {
        if (openOnly && String(r.status).toLowerCase() === "closed") return false;
        const L = Number(r.likelihood ?? Math.round(Math.sqrt(Number(r.current || r.inherent || 0))) ?? 0) || 0;
        const I = Number(r.impact ?? Math.round(Number(r.current || r.inherent || 0) / Math.max(L, 1)) ?? 0) || 0;
        // Prefer explicit fields; fall back to factoring score into bands
        const lik = Number(r.likelihood) || L || 0;
        const imp = Number(r.impact) || I || 0;
        if (lik && imp) return lik === row && imp === col;
        // If only score known, place on diagonal-ish bands
        const score = Number(r.current ?? r.inherent ?? 0);
        if (!score) return false;
        // Approximate placement when L/I missing
        return false;
      });
      const score = row * col;
      cells.push({ row, col, val: risks.length, color: scoreColor(score), risks });
    }
  }
  // Second pass: place risks missing L/I by score into the matching product band
  for (const r of register) {
    if (openOnly && String(r.status).toLowerCase() === "closed") continue;
    if (Number(r.likelihood) && Number(r.impact)) continue;
    const score = Number(r.current ?? r.inherent ?? 0);
    if (!score) continue;
    // Find cell whose product equals score (or closest)
    let best = cells[0];
    let bestDiff = Infinity;
    for (const c of cells) {
      const diff = Math.abs(c.row * c.col - score);
      if (diff < bestDiff) { bestDiff = diff; best = c; }
    }
    if (best && !best.risks.includes(r)) {
      best.risks.push(r);
      best.val = best.risks.length;
    }
  }
  return cells;
}

const LIKELIHOOD_LABELS = ["5 Almost Certain", "4 Likely", "3 Possible", "2 Unlikely", "1 Rare"];
const IMPACT_LABELS = ["1 Insignificant", "2 Minor", "3 Moderate", "4 Major", "5 Severe"];

const RISK_REPORTS = [
  { title: "Risk Register Report", sub: "Complete list of all project risks", pdf: true, excel: true },
  { title: "Risk Status Report", sub: "Open vs closed risks summary", pdf: true, excel: true },
  { title: "Risk Matrix Report", sub: "Current risk matrix and analysis", pdf: true, excel: true },
  { title: "Risk Trend Report", sub: "Risk trends over time", pdf: true, excel: true },
  { title: "Risk Action Report", sub: "Overdue and pending risk actions", pdf: true, excel: true },
];

export function Issues() {
  const navigate = useNavigate();
  const { activeProjectId } = useWorkspace();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [register, setRegister] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const url = activeProjectId
      ? `/risks?project_id=${encodeURIComponent(activeProjectId)}`
      : "/risks";
    get<any[]>(url)
      .then(items => setRegister((items || []).map(r => ({
        ...r,
        id: r.reference || `R-${r.id}`,
        desc: r.description,
        cat: r.category,
        likelihood: Number(r.likelihood || 0),
        impact: Number(r.impact || 0),
        inherent: r.inherent ?? (Number(r.likelihood || 0) * Number(r.impact || 0)),
        current: r.current ?? r.score ?? (Number(r.likelihood || 0) * Number(r.impact || 0)),
        trend: "flat",
        status: r.status === "open" ? "Open" : (r.status || "Open"),
        nextReview: r.next_review || "—",
        color: (r.current ?? r.score ?? 0) >= 15 ? "#ef4444" : (r.current ?? r.score ?? 0) >= 8 ? "#f59e0b" : "#10b981",
      }))))
      .catch((e) => { setRegister([]); setLoadError(e.message || "Failed to load risks"); })
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  const matrixCells = useMemo(() => buildMatrixCells(register, true), [register]);
  const matrixStats = useMemo(() => {
    const open = register.filter((r) => String(r.status).toLowerCase() !== "closed");
    return {
      high: open.filter((r) => Number(r.current) >= 15).length,
      medium: open.filter((r) => Number(r.current) >= 8 && Number(r.current) < 15).length,
      low: open.filter((r) => Number(r.current) < 8).length,
    };
  }, [register]);

  const downloadReport = (format: "pdf" | "excel", reportTitle: string) => {
    const rows = register.map(r => [r.id, r.desc, r.cat, r.owner, r.inherent, r.current, r.status, r.nextReview]);
    if (format === "excel") {
      const csv = [["Risk ID", "Description", "Category", "Owner", "Inherent Score", "Current Score", "Status", "Next Review"], ...rows]
        .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `${reportTitle.replaceAll(" ", "_")}.csv`; a.click(); URL.revokeObjectURL(url);
      return;
    }
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(`<html><head><title>${reportTitle}</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px;text-align:left}h1{font-size:20px}</style></head><body><h1>${reportTitle}</h1><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr><th>ID</th><th>Description</th><th>Category</th><th>Owner</th><th>Current score</th><th>Status</th><th>Review</th></tr></thead><tbody>${register.map(r => `<tr><td>${r.id}</td><td>${r.desc}</td><td>${r.cat}</td><td>${r.owner}</td><td>${r.current}</td><td>${r.status}</td><td>${r.nextReview}</td></tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Sub Nav Bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 16px", borderRadius: 8, border: 0,
            background: activeTab === tab.id ? "var(--surface-3)" : "transparent",
            color: activeTab === tab.id ? "var(--text)" : "var(--muted)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Risk Management</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Identify, assess, and monitor project risks and mitigation actions
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn primary" onClick={async () => { const description = window.prompt("Describe the new risk"); if (!description || !activeProjectId) return; const created = await post<any>("/risks", { project_id: activeProjectId, description, reference: `R-${Date.now().toString().slice(-4)}` }); setRegister(items => [{ ...created, id: created.reference, desc: created.description, cat: created.category, inherent: created.inherent, current: created.current, status: "Open", owner: created.owner, nextReview: created.next_review || "—", color: created.current >= 15 ? "#ef4444" : created.current >= 8 ? "#f59e0b" : "#10b981" }, ...items]); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Add New Risk
          </button>
        </div>
      </div>

      {loadError && <div className="card" style={{ padding: 12, color: "var(--danger)" }}>{loadError}</div>}
      {loading && <div className="muted" style={{ fontSize: 13 }}>Loading risk register…</div>}

      {/* KPI Cards from live register */}
      {(() => {
        const total = register.length;
        const high = register.filter((r) => Number(r.current) >= 15).length;
        const medium = register.filter((r) => Number(r.current) >= 8 && Number(r.current) < 15).length;
        const low = register.filter((r) => Number(r.current) < 8).length;
        const open = register.filter((r) => String(r.status).toLowerCase() === "open" || String(r.status).toLowerCase() === "in_progress").length;
        const closed = register.filter((r) => String(r.status).toLowerCase() === "closed").length;
        const kpis = [
          { label: "Total Risks", value: total, sub: activeProjectId ? "Selected project" : "All projects", color: "#3b82f6" },
          { label: "High Risks", value: high, sub: total ? `${Math.round((high / total) * 100)}% of total` : "—", color: "#ef4444" },
          { label: "Medium Risks", value: medium, sub: total ? `${Math.round((medium / total) * 100)}% of total` : "—", color: "#f59e0b" },
          { label: "Low Risks", value: low, sub: total ? `${Math.round((low / total) * 100)}% of total` : "—", color: "#10b981" },
          { label: "Open Risks", value: open, sub: total ? `${Math.round((open / total) * 100)}% of total` : "—", color: "#3b82f6" },
          { label: "Closed Risks", value: closed, sub: total ? `${Math.round((closed / total) * 100)}% of total` : "—", color: "#6b7280" },
        ];
        return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            padding: "12px 14px", borderRadius: 10, background: "var(--surface)",
            border: "1px solid var(--border)", borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>
        );
      })()}

      {/* Main Grid: Risk Register + 5x5 Matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        {/* Risk Register Table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>RISK REGISTER</span>
            <button className="btn ghost sm" style={{ fontSize: 12, color: "var(--primary)" }} onClick={() => downloadReport("excel", "Risk Register Report")}>Export →</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                {["ID", "Risk Description", "Category", "Owner", "Score", "Status", "Review"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {register.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                  No risks in the register yet. Add one to get started.
                </td></tr>
              )}
              {register.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--primary)", fontFamily: "monospace" }}>{r.id}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.desc}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "var(--surface-3)", color: "var(--muted)", fontWeight: 600 }}>{r.cat}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{r.owner}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 8, background: `${r.color}20`, color: r.color }}>{r.current}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>{r.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 11 }}>{r.nextReview}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5x5 Visual Risk Matrix Grid */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>5x5 RISK MATRIX HEATMAP (Current)</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>Impact vs Likelihood heat map</div>

          <div style={{ display: "flex", gap: 8 }}>
            {/* Y Axis Label */}
            <div style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Likelihood →
            </div>

            {/* Matrix */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateRows: "repeat(5, 38px)", gap: 4, marginBottom: 6 }}>
                {[5, 4, 3, 2, 1].map(r => (
                  <div key={r} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(c => {
                      const cell = matrixCells.find(m => m.row === r && m.col === c);
                      const bg = cell?.color === "#ef4444" ? "rgba(239,68,68,0.25)" : cell?.color === "#f59e0b" ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)";
                      return (
                        <div key={c} onClick={() => setSelectedCell(`${r}-${c}`)} title={`${cell?.val || 0} open risk(s)`} style={{
                          background: bg, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 900, fontSize: 13, color: cell?.color, cursor: "pointer", border: selectedCell === `${r}-${c}` ? "2px solid var(--text)" : "1px solid transparent",
                        }}>
                          {cell?.val || 0}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* X Axis Label */}
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>
                Impact →
              </div>
              {selectedCell && (
                <div style={{ marginTop: 12, fontSize: 12 }}>
                  <strong>Cell {selectedCell}:</strong>{" "}
                  {(matrixCells.find((m) => `${m.row}-${m.col}` === selectedCell)?.risks || []).map((r) => r.id).join(", ") || "no open risks"}
                </div>
              )}
            </div>

            {/* Legend — live counts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
              <div style={{ color: "#ef4444" }}>● High ({matrixStats.high})</div>
              <div style={{ color: "#f59e0b" }}>● Medium ({matrixStats.medium})</div>
              <div style={{ color: "#10b981" }}>● Low ({matrixStats.low})</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Row */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>RISK REPORTS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {RISK_REPORTS.map((rp, i) => (
            <div key={i} style={{ padding: "12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <FileText size={16} style={{ color: "var(--primary)", marginBottom: 6 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{rp.title}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>{rp.sub}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => downloadReport("pdf", rp.title)}>PDF</button>
                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => downloadReport("excel", rp.title)}>Excel</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>}

      {activeTab === "register" && <div className="card"><h3>Risk Register</h3><p className="muted">{loading ? "Loading persistent project risks…" : "Filterable register of risks and their owners."}</p><table><thead><tr><th>ID</th><th>Description</th><th>Category</th><th>Owner</th><th>Inherent</th><th>Current</th><th>Status</th></tr></thead><tbody>{register.map(r => <tr key={r.id}><td className="mono">{r.id}</td><td>{r.desc}</td><td>{r.cat}</td><td>{r.owner}</td><td>{r.inherent}</td><td>{r.current}</td><td>{r.status}</td></tr>)}</tbody></table></div>}
      {activeTab === "category" && <div className="grid">{Array.from(new Set(register.map(r => r.cat))).map(category => { const items = register.filter(r => r.cat === category); return <div className="card" key={category}><h3>{category}</h3><div className="stat">{items.length}</div><p className="muted">{items.filter(r => r.status === "Open").length} open risk(s)</p>{items.map(r => <div className="row" key={r.id} style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", padding: "8px 0" }}><span>{r.id}</span><span>{r.current}</span></div>)}</div>; })}</div>}
      {activeTab === "matrix" && <div className="card"><h3>Risk Matrix</h3><p className="muted">Live counts from the open risk register (likelihood × impact).</p><div className="grid">{matrixCells.map(cell => <button className="card" key={`${cell.row}-${cell.col}`} onClick={() => setSelectedCell(`${cell.row}-${cell.col}`)} style={{ cursor: "pointer", border: selectedCell === `${cell.row}-${cell.col}` ? "2px solid var(--text)" : "1px solid var(--border)", background: `${cell.color}20` }}><strong>{cell.row} × {cell.col}</strong><div>{cell.val} risk(s)</div></button>)}</div>
        {selectedCell && <div style={{ marginTop: 12 }}><strong>Selected {selectedCell}:</strong> {(matrixCells.find(c => `${c.row}-${c.col}` === selectedCell)?.risks || []).map(r => <div key={r.id}>{r.id} — {r.desc}</div>)}</div>}
      </div>}
      {activeTab === "reports" && <div className="card"><h3>Risk Reports</h3><p className="muted">Generate a printable PDF or spreadsheet export from the current risk register.</p><div className="grid">{RISK_REPORTS.map(report => <div className="card" key={report.title}><FileText size={18} /><h3>{report.title}</h3><p className="muted">{report.sub}</p><div className="row"><button className="btn sm" onClick={() => downloadReport("pdf", report.title)}>PDF</button><button className="btn ghost sm" onClick={() => downloadReport("excel", report.title)}>Excel</button></div></div>)}</div></div>}
    </div>
  );
}
