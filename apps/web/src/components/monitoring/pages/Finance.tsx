import React, { useEffect, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import {
  FileText, TrendingUp, AlertTriangle, CheckCircle2, DollarSign, Download, Plus,
  FileSpreadsheet, ShieldAlert, ArrowUpRight, ChevronRight, PieChart, BarChart2,
  Clock, Eye, UserCheck, Shield
} from "lucide-react";

import { API_BASE, authHeaders, fetchCertificates, fetchDisbursements, fetchProjects, fetchRequisitions, get } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { useWorkspace } from "../context/WorkspaceContext";

interface ProjectOption { id: string; name: string }

const money = (v: number | string) => {
  const num = Number(v || 0);
  return "KSh " + (num >= 1000000000 ? (num / 1000000000).toFixed(2) + "B" : num >= 1000000 ? (num / 1000000).toFixed(2) + "M" : num.toLocaleString());
};

export function Finance() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { activeProjectId, selectProject } = useWorkspace();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [costDashboard, setCostDashboard] = useState<any>(null);
  const [certList, setCertList] = useState<any[]>([]);
  const [consultantList, setConsultantList] = useState<any[]>([]);
  const [provList, setProvList] = useState<any[]>([]);
  const [contingencyList, setContingencyList] = useState<any[]>([]);
  const [fundingRequests, setFundingRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects()
      .then((p: ProjectOption[]) => {
        setProjects(p);
        const selected = activeProjectId && p.some(project => project.id === activeProjectId) ? activeProjectId : p[0]?.id || "";
        if (!projectFilter && selected) setProjectFilter(selected);
      })
      .catch((e) => setError(e.message));
  }, [activeProjectId]);

  useEffect(() => {
    if (projectFilter && projectFilter !== activeProjectId) selectProject(projectFilter);
  }, [projectFilter, activeProjectId, selectProject]);

  useEffect(() => {
    const pid = projectFilter;
    if (!pid) {
      setCostDashboard(null);
      setCertList([]); setConsultantList([]); setFundingRequests([]);
      setProvList([]);
      setContingencyList([]);
      return;
    }
    setError(null);
    get<any>(`/projects/${pid}/cost-dashboard`).then(setCostDashboard).catch((e) => setError(e.message));
    get<any>(`/finance/certificates?project_id=${encodeURIComponent(pid)}`).then(res => setCertList(Array.isArray(res) ? res : (res as any)?.results || [])).catch(() => setCertList([]));
    get<any>(`/projects/${pid}/consultant-payments`).then(res => setConsultantList(Array.isArray(res) ? res : (res as any)?.results || [])).catch(() => setConsultantList([]));
    get<any>(`/projects/${pid}/provisional-sums`).then(res => setProvList(Array.isArray(res) ? res : (res as any)?.results || [])).catch((e) => { setProvList([]); setError(`Provisional sums could not be loaded: ${e.message}`); });
    get<any>(`/projects/${pid}/contingency-drawdowns`).then(res => setContingencyList(Array.isArray(res) ? res : (res as any)?.results || [])).catch(() => setContingencyList([]));
    get<any>(`/drawdown-requests?project_id=${encodeURIComponent(pid)}`).then(res => setFundingRequests(Array.isArray(res) ? res : (res as any)?.results || [])).catch(() => setFundingRequests([]));
  }, [projectFilter]);

  // Defensive array checks to prevent runtime errors when non-array objects are returned
  const safeCertList = Array.isArray(certList) ? certList : [];
  const safeProvList = Array.isArray(provList) ? provList : [];
  const safeContingencyList = Array.isArray(contingencyList) ? contingencyList : [];
  const safeFundingRequests = Array.isArray(fundingRequests) ? fundingRequests : [];
  const safeConsultantList = Array.isArray(consultantList) ? consultantList : [];

  // Honest zeros when cost dashboard has not returned yet / has no figures.
  const contractSumVal = Number(costDashboard?.budget ?? 0);
  const certifiedToDateVal = Number(costDashboard?.certified_to_date ?? 0);
  const paidToDateVal = Number(costDashboard?.paid_to_date ?? 0);
  const balanceToBePaidVal = certifiedToDateVal - paidToDateVal;
  const certifiedPercentVal = contractSumVal > 0 ? (certifiedToDateVal / contractSumVal * 100).toFixed(1) : "0.0";
  const paidPercentVal = certifiedToDateVal > 0 ? (paidToDateVal / certifiedToDateVal * 100).toFixed(1) : "0.0";
  const downloadFinancialReport = async () => {
    if (!projectFilter) { setError("Select a project before downloading a report."); return; }
    try {
      const res = await fetch(`${API_BASE}/finance/reports/cost-dashboard?project_id=${encodeURIComponent(projectFilter)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Report download failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${projectFilter}-financial-report.pdf`; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { setError(e?.message || "Report download failed"); }
  };

  const paymentCertificates = safeCertList.map((c, i) => ({
    no: c.certificate_number || c.number || String(safeCertList.length - i),
    period: c.notes || `Cert #${c.id}`,
    gross: Number(c.approved_fee || c.current_gross || c.amount || 0),
    retention: Number(c.retention_amount ?? (Number(c.amount || 0) * (Number(c.retention_percent || 0) / 100))),
    advance: Number(c.advance_recovery || 0),
    net: Number(c.net_payable || c.amount || 0),
    status: c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "—",
    paidOn: c.created_at || c.issued_at ? new Date(c.created_at || c.issued_at).toLocaleDateString() : "—",
  }));

  const provisionalSumItems = safeProvList.map(p => ({
    item: p.name,
    budget: Number(p.allocated_amount || 0),
    spent: Number(p.spent_amount || 0),
    balance: Number(p.allocated_amount || 0) - Number(p.spent_amount || 0),
    usedPct: p.allocated_amount > 0 ? Math.round((p.spent_amount / p.allocated_amount) * 100) : 0,
  }));

  const contingencyLogs = safeContingencyList.map(c => ({
    date: c.created_at ? new Date(c.created_at).toLocaleDateString() : "—",
    desc: c.description,
    amount: Number(c.amount || 0),
    appBy: c.approved_by || "—",
  }));
  const fundingRequested = safeFundingRequests.reduce((s, r) => s + Number(r.amount || 0), 0);
  const fundingApproved = safeFundingRequests.filter(r => ["approved", "disbursed", "paid"].includes(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const fundingDisbursed = safeFundingRequests.filter(r => ["disbursed", "paid"].includes(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const contingencyUsed = safeContingencyList.filter(c => c.status === "approved").reduce((s, c) => s + Number(c.amount || 0), 0);
  const advanceRecovered = Number(costDashboard?.advance_recovered || costDashboard?.advance_paid_to_date || 0);
  const advanceOutstanding = Number(costDashboard?.advance_outstanding || 0);

  // Consultant payments already loaded into certList for this project endpoint.
  const consultants = safeConsultantList.map((c: any) => ({
    name: c.consultant_name || c.name || c.notes || `Consultant #${c.id}`,
    fee: Number(c.approved_fee || c.amount || 0),
    paid: Number(c.paid_amount || (c.status === "paid" ? c.amount : 0) || 0),
    balance: Number(c.approved_fee || c.amount || 0) - Number(c.paid_amount || (c.status === "paid" ? c.amount : 0) || 0),
    status: c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "—",
  }));

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
      {/* Top Header & Project Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }} onClick={() => navigate("/app/projects")}>
            ← Back to Projects
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--text)" }}>
              {projects.find((p) => p.id === projectFilter)?.name || "Financial Monitoring"}
            </h1>
            <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--color-emerald)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              Live data
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
            {projectFilter ? "Project financial figures" : "Select a project to load cost figures"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); selectProject(e.target.value); }}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", color: "var(--text)" }}
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", color: "var(--muted)" }}>
            As at <strong>{new Date().toLocaleDateString("en-GB")}</strong>
          </div>
          <button className="btn" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontWeight: 700 }} onClick={() => navigate("/app/reports")}>
            Reports
          </button>
          <button
            className="btn btn-primary"
            onClick={() => projectFilter && navigate(`/app/projects/${projectFilter}/generate-ipc`)}
            disabled={!projectFilter}
          >
            + New IPC
          </button>
        </div>
      </div>

      {/* 6 Top Metric Cards (Row 1) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Contract Sum</div>
          <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--text)" }}>{money(contractSumVal)}</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Certified to Date</div>
          <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-brand-blue)" }}>{money(certifiedToDateVal)}</div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{certifiedPercentVal}% of Contract Sum</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Paid to Date</div>
          <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-emerald)" }}>{money(paidToDateVal)}</div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{paidPercentVal}% of Certified</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Balance to be Paid</div>
          <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-amber)" }}>{money(balanceToBePaidVal)}</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Budget Utilization</div>
          <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-emerald)" }}>{certifiedPercentVal}%</div>
          <div style={{ fontSize: "11px", color: "var(--color-emerald)", marginTop: "2px" }}>On Track</div>
        </div>

        <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Overall Financial Health</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-emerald)" }}>Good</div>
        </div>
      </div>

      {/* 5 Secondary Sub-Metric Cards (Row 2) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
        <div className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>Provisional Sum Used</div>
            <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "IBM Plex Mono" }}>KSh 42.60M</div>
            <div style={{ fontSize: "10px", color: "var(--muted)" }}>of KSh 112.00M</div>
          </div>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "3px solid var(--color-brand-blue)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700 }}>38%</div>
        </div>

        <div className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--color-warning)" }}>Contingency Drawdown Utilization</div>
            <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "IBM Plex Mono" }}>KSh 8.50M</div>
            <div style={{ fontSize: "10px", color: "var(--muted)" }}>of KSh 35.00M</div>
          </div>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "3px solid var(--color-emerald)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700 }}>24%</div>
        </div>

        <div className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--color-violet)" }}>Advance Payments &amp; Recovery</div>
            <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "IBM Plex Mono" }}>KSh 76.00M</div>
            <div style={{ fontSize: "10px", color: "var(--muted)" }}>of KSh 125.00M</div>
          </div>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "3px solid var(--color-amber)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700 }}>61%</div>
        </div>

        <div className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>Retention Held</div>
          <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-amber)" }}>KSh 49.20M</div>
          <div style={{ fontSize: "10px", color: "var(--muted)" }}>2.66% of Contract Sum</div>
        </div>

        <div className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>Variation Orders</div>
          <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--color-danger)" }}>KSh 72.00M</div>
          <div style={{ fontSize: "10px", color: "var(--muted)" }}>3.89% of Contract Sum</div>
        </div>
      </div>

      {/* Main Grid: Left Main Area + Right Summary Side Panel (Photo Layout) */}
      <div className="card" style={{ padding: 18, borderTop: "3px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}><div><h3 style={{ margin: 0 }}>Funding &amp; Deductions Summary</h3><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Separate cash releases, contingency use, and contractor advance recovery.</div></div><span className="badge">Project view</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <div className="card" style={{ padding: 12, borderLeft: "3px solid var(--color-info)" }}><strong style={{ color: "var(--color-info)" }}>Funding Drawdowns</strong><div className="muted fs-sm">Requested {money(fundingRequested)}</div><div className="muted fs-sm">Approved {money(fundingApproved)}</div><div className="fs-sm">Disbursed <b>{money(fundingDisbursed)}</b></div></div>
          <div className="card" style={{ padding: 12, borderLeft: "3px solid var(--color-warning)" }}><strong style={{ color: "var(--color-warning)" }}>Contingency Drawdowns</strong><div className="muted fs-sm">Used {money(contingencyUsed)}</div><div className="fs-sm">Approved records <b>{contingencyList.filter(c => c.status === "approved").length}</b></div><div className="muted fs-sm">Allowance tracked in Cost Dashboard</div></div>
          <div className="card" style={{ padding: 12, borderLeft: "3px solid var(--color-violet)" }}><strong style={{ color: "var(--color-violet)" }}>Advance Recovery</strong><div className="muted fs-sm">Recovered {money(advanceRecovered)}</div><div className="fs-sm">Outstanding <b>{money(advanceOutstanding)}</b></div><div className="muted fs-sm">Recovered through IPC deductions</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
        {/* Left Main Dashboard Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Payment Certificates Table */}
          <div className="card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>PAYMENT CERTIFICATES</h3>
              <span style={{ fontSize: "12px", color: "var(--color-brand-blue)", cursor: "pointer" }} onClick={() => navigate(`/app/projects/${projectFilter}/generate-ipc`)}>View all certificates →</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "8px" }}>Cert. No.</th>
                    <th style={{ padding: "8px" }}>Period</th>
                    <th style={{ padding: "8px" }}>Gross Valuation (KSh)</th>
                    <th style={{ padding: "8px" }}>Retention (5%)</th>
                    <th style={{ padding: "8px" }}>Advance Recovery</th>
                    <th style={{ padding: "8px" }}>Net Payment (KSh)</th>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Paid On</th>
                    <th style={{ padding: "8px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentCertificates.map((cert, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px", fontWeight: 700 }}>{cert.no}</td>
                      <td style={{ padding: "8px", color: "var(--muted)" }}>{cert.period}</td>
                      <td style={{ padding: "8px", fontFamily: "IBM Plex Mono" }}>{cert.gross.toLocaleString()}</td>
                      <td style={{ padding: "8px", fontFamily: "IBM Plex Mono", color: "var(--color-amber)" }}>{cert.retention.toLocaleString()}</td>
                      <td style={{ padding: "8px", fontFamily: "IBM Plex Mono", color: "var(--color-brand-blue)" }}>{cert.advance.toLocaleString()}</td>
                      <td style={{ padding: "8px", fontFamily: "IBM Plex Mono", fontWeight: 700, color: "var(--color-emerald)" }}>{cert.net.toLocaleString()}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "var(--color-emerald)", fontWeight: 600 }}>{cert.status}</span>
                      </td>
                      <td style={{ padding: "8px", color: "var(--muted)" }}>{cert.paidOn}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}><Eye size={14} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={() => navigate(`/app/projects/${projectFilter}/generate-ipc`)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Utilization & Registers Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Provisional Sum Register */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "14px" }}>PROVISIONAL SUM REGISTER</h4>
                <span style={{ fontSize: "11px", color: "var(--color-brand-blue)", cursor: "pointer" }} onClick={() => navigate(`/app/projects/${projectFilter}/provisional-sums`)}>View all →</span>
              </div>
              <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "6px" }}>Item</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>Budget</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>Spent</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>Balance</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>% Used</th>
                  </tr>
                </thead>
                <tbody>
                  {provisionalSumItems.map((ps, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px", fontWeight: 600 }}>{ps.item}</td>
                      <td style={{ padding: "6px", textAlign: "right", fontFamily: "IBM Plex Mono" }}>{(ps.budget/1000000).toFixed(1)}M</td>
                      <td style={{ padding: "6px", textAlign: "right", fontFamily: "IBM Plex Mono" }}>{(ps.spent/1000000).toFixed(1)}M</td>
                      <td style={{ padding: "6px", textAlign: "right", fontFamily: "IBM Plex Mono", color: "var(--color-emerald)" }}>{(ps.balance/1000000).toFixed(1)}M</td>
                      <td style={{ padding: "6px", textAlign: "right", fontWeight: 700, color: ps.usedPct > 50 ? "var(--color-amber)" : "var(--color-brand-blue)" }}>{ps.usedPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Contingency Register */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div><h4 style={{ margin: 0, fontSize: "14px" }}>CONTINGENCY DRAWDOWNS</h4><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Uses approved contingency allowance for unforeseen costs.</div></div>
                <span style={{ fontSize: "11px", color: "var(--color-brand-blue)", cursor: "pointer" }} onClick={() => navigate(`/app/projects/${projectFilter}/contingency-drawdowns`)}>View all →</span>
              </div>
              <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "6px" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "6px" }}>Description</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>Amount (KSh)</th>
                    <th style={{ textAlign: "right", padding: "6px" }}>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {contingencyLogs.map((ctg, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px", color: "var(--muted)" }}>{ctg.date}</td>
                      <td style={{ padding: "6px", fontWeight: 600 }}>{ctg.desc}</td>
                      <td style={{ padding: "6px", textAlign: "right", fontFamily: "IBM Plex Mono" }}>{ctg.amount.toLocaleString()}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: "var(--primary)" }}>{ctg.appBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side Panel (Photo 08 Financial Summary + Alerts) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* FINANCIAL SUMMARY Card */}
          <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)" }}>FINANCIAL SUMMARY</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Contract Sum</span><strong style={{ fontFamily: "IBM Plex Mono" }}>{money(contractSumVal)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Approved Variations</span><strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-danger)" }}>{money(Number(costDashboard?.approved_variations || 0))}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px solid var(--border)" }}><span>Revised Contract Sum</span><strong style={{ fontFamily: "IBM Plex Mono" }}>{money(contractSumVal + Number(costDashboard?.approved_variations || 0))}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Certified to Date</span><strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-brand-blue)" }}>{money(certifiedToDateVal)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Paid to Date</span><strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-emerald)" }}>{money(paidToDateVal)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Balance to be Paid</span><strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-amber)" }}>{money(balanceToBePaidVal)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Retention Held</span><strong style={{ fontFamily: "IBM Plex Mono" }}>{money(Number(costDashboard?.retention_held || 0))}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Advance Outstanding</span><strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-danger)" }}>{money(Number(costDashboard?.advance_outstanding || 0))}</strong></div>
            </div>
            <div onClick={downloadFinancialReport} role="button" tabIndex={0} style={{ marginTop: "14px", fontSize: "11px", color: "var(--color-brand-blue)", cursor: "pointer", textAlign: "center", fontWeight: 600 }}>
              View Full Financial Status Report →
            </div>
          </div>

          {/* ALERTS & ACTIONS Card */}
          <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)" }}>ALERTS & ACTIONS</h4>
              <span style={{ fontSize: "11px", color: "var(--color-brand-blue)" }}>View all →</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px" }}>
              <div style={{ background: "rgba(239, 68, 68, 0.1)", borderLeft: "3px solid var(--color-danger)", padding: "8px", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "var(--color-danger)" }}>Advance recovery is 61%</strong>
                  <div style={{ color: "var(--muted)" }}>Recover KSh 49.00M more</div>
                </div>
                <button className="btn sm" style={{ background: "var(--color-danger)", color: "#fff", border: "none", fontSize: "10px", padding: "2px 8px" }}>Action</button>
              </div>

              <div style={{ background: "rgba(0, 163, 255, 0.1)", borderLeft: "3px solid var(--color-brand-blue)", padding: "8px", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "var(--color-brand-blue)" }}>Contingency utilization at 24%</strong>
                  <div style={{ color: "var(--muted)" }}>Monitor usage</div>
                </div>
                <button className="btn sm" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", fontSize: "10px", padding: "2px 8px" }}>Info</button>
              </div>

              <div style={{ background: "rgba(245, 158, 11, 0.1)", borderLeft: "3px solid var(--color-amber)", padding: "8px", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "var(--color-amber)" }}>2 CFO invoices pending approval</strong>
                  <div style={{ color: "var(--muted)" }}>Total KSh 1.85M</div>
                </div>
                <button className="btn sm" style={{ background: "var(--color-amber)", color: "#fff", border: "none", fontSize: "10px", padding: "2px 8px" }}>Action</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Financial Reports PDF Row */}
      <div className="card" style={{ padding: "16px" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>FINANCIAL REPORTS (PDF / EXCEL EXPORTS)</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
          {[
            "Financial Status Report", "Payment Certificate Register", "Provisional Sum Utilization", "Contingency Utilization",
            "Consultant Payment Status", "Advance Recovery Schedule", "Retention Register", "Budget vs Actual Report",
            "Cash Flow Report", "Complete Financial Audit Report"
          ].map((rpt, idx) => (
            <button key={idx} onClick={downloadFinancialReport} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "10px", borderRadius: "6px", textAlign: "center", cursor: "pointer", color: "var(--text)" }} title={`Download ${rpt}`}>
              <FileText size={20} style={{ color: "var(--color-danger)", marginBottom: "4px" }} />
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)", lineHeight: "1.2" }}>{rpt}</div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "4px" }}>PDF</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Quick Actions Row */}
      <div className="card" style={{ padding: "16px" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>QUICK ACTIONS</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {[
            { label: "Create Payment Certificate", icon: Plus, action: () => navigate("/app/projects/default/generate-ipc") },
            { label: "Record Consultant Payment", icon: DollarSign, action: () => navigate("/app/projects/default/consultant-payments") },
            { label: "Record Provisional Sum", icon: FileSpreadsheet, action: () => navigate("/app/projects/default/provisional-sums") },
            { label: "Record Contingency Use", icon: ShieldAlert, action: () => navigate("/app/projects/default/contingency-drawdowns") },
            { label: "Recover Advance Payment", icon: TrendingUp, action: () => navigate("/app/projects/default/advance-payments") },
            { label: "Release Retention", icon: CheckCircle2, action: () => navigate("/app/projects/default/boq-cost-states") },
          ].map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={act.action}
                className="btn"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  padding: "12px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <Icon size={18} style={{ color: "var(--primary)" }} />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
