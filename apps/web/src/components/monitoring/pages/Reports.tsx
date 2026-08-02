import React, { useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import {
  FileText, Download, Calendar, Filter, Plus, FileSpreadsheet, CheckCircle2,
  Clock, ArrowUpRight, BarChart3, ShieldCheck, Sparkles, RefreshCw, X
} from "lucide-react";
import { API_BASE, authHeaders } from "../api";
import { ReportExportModal } from "../components/ReportExportModal";
import { useWorkspace } from "../context/WorkspaceContext";

export function Reports() {
  const navigate = useNavigate();
  const { activeProjectId, activeProject, projects } = useWorkspace();
  const [filterPeriod, setFilterPeriod] = useState("Jul 2026");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("T1");
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeScurve, setIncludeScurve] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportTemplates = [
    {
      id: "T1",
      title: "Monthly Progress Report (MPR)",
      desc: "Executive progress summary, financial health, S-curve variance, 5x5 risk matrix & CoW site photos.",
      format: "PDF / Excel",
      badge: "Primary Executive",
    },
    {
      id: "T2",
      title: "Financial Audit & Certificate Statement",
      desc: "IPCs ledger, Provisional Sums, Contingency utilization, Retention register & consultant fee disbursements.",
      format: "PDF / Excel",
      badge: "Financial Audit",
    },
    {
      id: "T3",
      title: "Site Inspection & Quality Test Log",
      desc: "Geotagged site visit logs, concrete cube strength test results & CoW daily records.",
      format: "PDF",
      badge: "Site Records",
    },
    {
      id: "T4",
      title: "Project Risk & Schedule Variance Report",
      desc: "Master WBS schedule, baseline vs actual, critical path activities & risk mitigation register.",
      format: "PDF",
      badge: "Risk & Schedule",
    },
  ];

  const generatedReports = [
    {
      id: "REP-2026-07",
      name: `${(activeProject?.name || "KASNEB_Towers_II").replace(/\s+/g, "_")}_Monthly_Progress_Report_Jul2026.pdf`,
      period: "Jul 2026",
      type: "Monthly Progress Report",
      generatedDate: "23 Jul 2026",
      size: "8.4 MB",
      status: "Final Approved",
    },
    {
      id: "REP-2026-06",
      name: `${(activeProject?.name || "KASNEB_Towers_II").replace(/\s+/g, "_")}_Financial_Audit_Statement_Q2_2026.xlsx`,
      period: "Jun 2026",
      type: "Financial Audit",
      generatedDate: "30 Jun 2026",
      size: "3.1 MB",
      status: "Final Approved",
    },
  ];

  const handleDownloadPdf = async (yearVal = reportYear, monthVal = reportMonth) => {
    const pid = activeProjectId || "kasneb-towers-2";
    const url = `${API_BASE}/reports/monthly.pdf?project_id=${encodeURIComponent(pid)}&year=${yearVal}&month=${monthVal}`;
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Report failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = objectUrl;
      a.download = `${activeProject?.name || "Project"}_Report_${yearVal}_${monthVal}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || "Unable to download report");
    }
  };

  const handleDownloadExcel = async (yearVal = reportYear, monthVal = reportMonth) => {
    const pid = activeProjectId || "kasneb-towers-2";
    try {
      const res = await fetch(`${API_BASE}/reports/monthly.xlsx?project_id=${encodeURIComponent(pid)}&year=${yearVal}&month=${monthVal}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Report failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeProject?.name || "Project"}_Report_${yearVal}_${monthVal}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      handleDownloadPdf(yearVal, monthVal);
    }
  };

  const handleRunGenerate = async () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setShowGenerateModal(false);
      handleDownloadPdf();
    }, 1200);
  };

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {error && <div className="error-banner" role="alert">{error}<button className="btn ghost sm" onClick={() => setError(null)}><X size={14} /></button></div>}
      {/* Top Header Bar (Mockup 13 Header) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text)" }}>Reports & Analytics Generator</h1>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            Automated Monthly Progress Reports (MPR), Financial Statements & Custom PDF/Excel Exports
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-primary" style={{ background: "#d92d2d", borderColor: "#d92d2d" }} onClick={() => setShowGenerateModal(true)}>
            <Plus size={15} style={{ marginRight: "4px" }} /> + Generate New Report
          </button>
        </div>
      </div>

      {/* Top 3 KPI Metrics Cards (Mockup 13 Metric Cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Reports Generated This Month</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)" }}>12 Reports</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Scheduled Auto-Distributions</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#00a3ff" }}>4 Auto-Schedules</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Audit Compliance Score</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>100% Compliant</div>
        </div>
      </div>

      {/* Report Templates Grid (Mockup 13 Templates) */}
      <div className="card" style={{ padding: "20px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "var(--text)" }}>EXECUTIVE REPORT TEMPLATES</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {reportTemplates.map((tpl) => (
            <div key={tpl.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(0,163,255,0.15)", color: "#00a3ff", fontWeight: 600 }}>
                    {tpl.badge}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{tpl.format}</span>
                </div>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{tpl.title}</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: "1.5" }}>{tpl.desc}</p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, background: "#00a3ff", borderColor: "#00a3ff", fontSize: "12px" }}
                  onClick={() => { setSelectedTemplate(tpl.id); setShowGenerateModal(true); }}
                >
                  Configure & Generate →
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "12px" }}
                  onClick={() => handleDownloadPdf()}
                  title="Quick download PDF"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Reports History Table (Mockup 13 History) */}
      <div className="card" style={{ padding: "20px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "var(--text)" }}>RECENTLY GENERATED REPORTS</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "8px" }}>Report ID</th>
                <th style={{ padding: "8px" }}>Report Name</th>
                <th style={{ padding: "8px" }}>Type</th>
                <th style={{ padding: "8px" }}>Period</th>
                <th style={{ padding: "8px" }}>Generated Date</th>
                <th style={{ padding: "8px" }}>Size</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {generatedReports.map((rep) => (
                <tr key={rep.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontWeight: 700, color: "var(--text)" }}>{rep.id}</td>
                  <td style={{ padding: "8px", fontWeight: 600, color: "#00a3ff" }}>{rep.name}</td>
                  <td style={{ padding: "8px", color: "var(--muted)" }}>{rep.type}</td>
                  <td style={{ padding: "8px" }}>{rep.period}</td>
                  <td style={{ padding: "8px", color: "var(--muted)" }}>{rep.generatedDate}</td>
                  <td style={{ padding: "8px", fontFamily: "IBM Plex Mono" }}>{rep.size}</td>
                  <td style={{ padding: "8px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600 }}>
                      {rep.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                    <button className="btn sm ghost" style={{ color: "#00a3ff" }} onClick={() => handleDownloadPdf()}>
                      <Download size={14} style={{ marginRight: "4px" }} /> PDF
                    </button>
                    <button className="btn sm ghost" style={{ color: "#10b981" }} onClick={() => handleDownloadExcel()}>
                      <FileSpreadsheet size={14} style={{ marginRight: "4px" }} /> Excel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <ReportExportModal onClose={() => setShowGenerateModal(false)} />
      )}
    </div>
  );
}
