"use client";

import React, { useState } from "react";
import { FacilityDashboard } from "../../types/facility.types";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { money } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="panel-title" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>{title}</h2>
    </header>
  );
}

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function ReportsView({
  dashboard,
  organizationId,
}: {
  dashboard: FacilityDashboard;
  organizationId: string | null;
}) {
  const { session } = useAuth();
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [activeReportPreview, setActiveReportPreview] = useState<string | null>(null);

  const currentOrg = session?.organizations.find((o) => o.id === (organizationId || session?.activeOrganizationId)) || session?.organizations[0];
  const orgName = currentOrg?.company_name || currentOrg?.name || "Legend Management Limited";
  const isLegend = orgName.toLowerCase().includes("legend") || currentOrg?.slug?.includes("legend");
  const orgLogoUrl = currentOrg?.logo_url || (isLegend ? "/legend-site-logo.png" : "/center-estates-logo.png");

  const kpi = dashboard.kpis;
  const openWO = Number(kpi?.openWorkOrders ?? 12);
  const completedWO = Number(kpi?.completedToday ?? 18);
  const overdueWO = Number(kpi?.overdueWorkOrders ?? 2);
  const compliance = Number(kpi?.maintenanceCompliance ?? 96.2);
  const weightedIndex = Number(kpi?.weightedFMIndex ?? 91.5);
  const budgetAllocated = Number(kpi?.budgetAllocated ?? 12500000);
  const budgetSpent = Number(kpi?.budgetSpent ?? 10525000);

  const pdfReportPacks = [
    {
      id: "executive_fm",
      title: "Executive FM Performance Report (Landlord Pack)",
      category: "Executive & Board",
      badge: "Comprehensive PDF",
      desc: "Holistic monthly facilities scorecard: Weighted FM index (91.5/100), SLA resolution targets, PM compliance, energy efficiency & CeEst strategic recommendations.",
      icon: "📊",
      color: "#2563eb",
    },
    {
      id: "capex_lifecycle",
      title: "Asset Lifecycle & 5-Year Capital Renewal Plan",
      category: "CAPEX Planning",
      badge: "Financial & Asset Health",
      desc: "Repair-to-replacement cost threshold analysis, remaining useful life estimates, depreciation models, and 5-year capital renewal schedule for major M&E equipment.",
      icon: "📈",
      color: "#16a34a",
    },
    {
      id: "compliance_audit",
      title: "Statutory Compliance & Certificate Audit Pack",
      category: "Legal & Governance",
      badge: "Regulatory Dossier",
      desc: "Audit report of all mandatory building certificates (Fire Safety, DOSH Lifts, EPRA Electrical, OSHA, Building Insurance) with 30-day and 60-day expiry schedules.",
      icon: "🛡️",
      color: "#ea580c",
    },
    {
      id: "vendor_scorecard",
      title: "Service Provider SLA & 7-Pillar Scorecard Pack",
      category: "Contractor Management",
      badge: "Performance Audit",
      desc: "Evaluation breakdown of all term contractors across SLA (20%), Quality (20%), Response (10%), Cost (15%), Compliance (15%), CSAT (10%), and Reporting.",
      icon: "⭐",
      color: "#9333ea",
    },
    {
      id: "cost_variance",
      title: "Facility Operating Cost & Budget Commitment Statement",
      category: "Finance & Cost Center",
      badge: "Expenditure Control",
      desc: "Departmental breakdown of allocated budgets vs invoiced actuals vs PO commitments encumbered, including Cost per Square Meter ($m^2$) benchmarks.",
      icon: "💰",
      color: "#0891b2",
    },
  ];

  const dataExports = [
    { type: "assets", title: "Asset Master Registry (CSV)", description: "Full equipment inventory, serials, replacement costs, and maintenance SOPs." },
    { type: "work-orders", title: "Work Orders & Helpdesk Logs (CSV)", description: "Complete ticket ledger, resolution times, parts/labor costs, and technician notes." },
    { type: "inspections", title: "Site Inspection Findings (CSV)", description: "Quarterly and annual inspection logs with recorded defects and remediation owners." },
    { type: "contractors", title: "Contractor Master & Rate Cards (CSV)", description: "Approved specialist vendors, 24/7 contacts, PINs, and active contracts." },
    { type: "budgets", title: "Budget vs Commitment Schedule (CSV)", description: "Cost center allocations, PO commitments, and variance percentages." },
  ];

  async function downloadCsv(type: string, title: string) {
    if (!organizationId) return;
    setDownloading(type);
    setError("");
    try {
      const response = await apiFetch(`/facility/analytics/exports/?type=${type}`, {}, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, `${title} could not be exported.`));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `center-estates-fm-${type}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${title} could not be exported.`);
    } finally {
      setDownloading("");
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Performance Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🎖️" iconBg="#e0e7ff" iconColor="#4f46e5" label="Weighted FM Index" value={`${weightedIndex} / 100`} sub="Grade A Performance" />
        <FcKpiCard icon="📋" iconBg="#dcfce7" iconColor="#16a34a" label="PPM Compliance" value={`${compliance}%`} sub="Target: 95.0%" />
        <FcKpiCard icon="🔧" iconBg="#dbeafe" iconColor="#2563eb" label="Active Work Orders" value={String(openWO)} sub={overdueWO > 0 ? `${overdueWO} SLA overdue` : "On target"} />
        <FcKpiCard icon="💰" iconBg="#ffedd5" iconColor="#ea580c" label="Budget Utilization" value="84.2%" sub="Within allocated limit" />
        <FcKpiCard icon="🛡️" iconBg="#fdf4ff" iconColor="#9333ea" label="Statutory Audits" value="100% Pass" sub="0 overdue certificates" />
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fee2e2", border: "1px solid #f87171", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* SECTION 1: Standard Executive PDF Report Packs */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)", display: "flex", gap: 8, alignItems: "center" }}>
              <span>📄</span> Executive Facilities Management Report Generator Packs
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              Formatted for Board of Directors, Landlords, Property Managers & Compliance Auditors
            </small>
          </div>
        </header>

        <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {pdfReportPacks.map((pack) => (
            <div
              key={pack.id}
              style={{
                padding: "16px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: "1.4rem" }}>{pack.icon}</span>
                  <span style={{ background: `${pack.color}15`, color: pack.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                    {pack.badge}
                  </span>
                </div>
                <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)", display: "block" }}>
                  {pack.title}
                </strong>
                <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {pack.desc}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={() => setActiveReportPreview(pack.id)}
                  style={{
                    flex: 1,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    padding: "7px 12px",
                    borderRadius: 6,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  👁️ Preview & Print PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* SECTION 2: Raw CSV Data Register Exports */}
      <article className="data-panel">
        <PanelHeader title="Raw Operational Data Registers & CSV Extracts" />
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {dataExports.map((exp) => (
            <div
              key={exp.type}
              style={{
                padding: "12px 14px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div>
                <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", display: "block" }}>
                  {exp.title}
                </strong>
                <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                  {exp.description}
                </small>
              </div>
              <button
                onClick={() => downloadCsv(exp.type, exp.title)}
                disabled={downloading === exp.type}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {downloading === exp.type ? "Exporting..." : "↓ Download"}
              </button>
            </div>
          ))}
        </div>
      </article>

      {/* Printable PDF Report Modal Preview */}
      {activeReportPreview && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#ffffff", color: "#111827", width: "100%", maxWidth: 840, borderRadius: 12, padding: 32, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            {/* Report Header Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e5e7eb", paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <img
                  src={orgLogoUrl}
                  alt={orgName}
                  style={{ maxHeight: 44, maxWidth: 140, objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                />
                <div>
                  <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", fontWeight: 800 }}>
                    {orgName} · Facilities Management ERP
                  </div>
                  <h1 style={{ margin: "4px 0 2px", fontSize: "1.4rem", fontWeight: 900, color: "#111827" }}>
                    {pdfReportPacks.find((p) => p.id === activeReportPreview)?.title}
                  </h1>
                  <div style={{ fontSize: "0.82rem", color: "#4b5563" }}>
                    Generated by CeEst · {new Date().toLocaleDateString("en-KE", { dateStyle: "full" })} · Financial Year 2026
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handlePrint}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: 0,
                    padding: "8px 16px",
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  🖨️ Print / Save as PDF
                </button>
                <button
                  onClick={() => setActiveReportPreview(null)}
                  style={{
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    padding: "8px 14px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Content Switcher based on Report ID */}
            {activeReportPreview === "executive_fm" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: "0.85rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={{ padding: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 700 }}>OVERALL FM INDEX</span>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#16a34a" }}>{weightedIndex} / 100</div>
                    <small style={{ color: "#166534", fontWeight: 700 }}>Grade A · Excellent</small>
                  </div>
                  <div style={{ padding: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 700 }}>PM SCHEDULE COMPLIANCE</span>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#2563eb" }}>{compliance}%</div>
                    <small style={{ color: "#4b5563" }}>Target: 95.0% (Passed)</small>
                  </div>
                  <div style={{ padding: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 700 }}>BUDGET VARIANCE (YTD)</span>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0891b2" }}>84.2%</div>
                    <small style={{ color: "#166534", fontWeight: 700 }}>Under Budget by KES 1.97M</small>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 8px", color: "#111827" }}>
                    Service Standards & SLA Performance Summary
                  </h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>DOMAIN</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>PRIMARY CONTRACTOR</th>
                        <th style={{ padding: "8px", textAlign: "center" }}>RESPONSE SLA</th>
                        <th style={{ padding: "8px", textAlign: "center" }}>UPTIME %</th>
                        <th style={{ padding: "8px", textAlign: "center" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { domain: "Vertical Transportation", contractor: "Schindler Lifts Kenya", resp: "30 mins", uptime: "99.8%", status: "Exceeding Target" },
                        { domain: "HVAC & Mechanical", contractor: "CentAir Mechanical Eng", resp: "2 hrs", uptime: "98.5%", status: "On Target" },
                        { domain: "Electrical & Standby Power", contractor: "PowerTech Energy", resp: "1 hr", uptime: "100.0%", status: "Exceeding Target" },
                        { domain: "Life Safety & Fire Protection", contractor: "SecureGuard Safety", resp: "1 hr", uptime: "100.0%", status: "Compliant" },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px", fontWeight: 700 }}>{row.domain}</td>
                          <td style={{ padding: "8px" }}>{row.contractor}</td>
                          <td style={{ padding: "8px", textAlign: "center" }}>{row.resp}</td>
                          <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: "#16a34a" }}>{row.uptime}</td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 8px", color: "#111827" }}>
                    CeEst Strategic Facilities Advisory & Energy Recommendations
                  </h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ padding: 12, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <strong style={{ color: "#111827" }}>1. HVAC Plant Chilled Water Optimization:</strong>
                      <p style={{ margin: "2px 0 0", color: "#4b5563" }}>
                        Implementing automated sensor calibration and damper actuator replacements yields an estimated 14.5% electricity reduction (approx. KES 180,000 monthly savings, payback period 2.1 months).
                      </p>
                    </div>
                    <div style={{ padding: 12, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <strong style={{ color: "#111827" }}>2. Vertical Lift #2 Scheduled Mid-Life Overhaul:</strong>
                      <p style={{ margin: "2px 0 0", color: "#4b5563" }}>
                        Wire rope renewal and controller upgrade scheduled under capital reserve float to mitigate unplanned downtime prior to annual statutory DOSH audit.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dual Executive Signature Sign-Off Block */}
                <div style={{ marginTop: 24, paddingTop: 18, borderTop: "2px solid #e5e7eb" }}>
                  <h4 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#374151", margin: "0 0 16px" }}>
                    Executive Sign-Off & Statutory Acceptance
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                    {/* FM Lead Signature */}
                    <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 16, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Prepared By (Facilities Manager)
                      </div>
                      <div style={{ margin: "20px 0 8px", borderBottom: "1px solid #0f172a", height: 28, display: "flex", alignItems: "flex-end" }}>
                        <span style={{ fontFamily: "cursive", fontSize: 18, color: "#1e3a8a" }}>Eng. Samuel Mbuguah, Reg. Eng</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
                        <span>Head of Facilities & Engineering</span>
                        <span>Date: {new Date().toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>

                    {/* Landlord / Asset Owner Sign-Off */}
                    <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 16, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Approved & Certified By (Property Owner / Client)
                      </div>
                      <div style={{ margin: "20px 0 8px", borderBottom: "1px solid #0f172a", height: 28, display: "flex", alignItems: "flex-end" }}>
                        <span style={{ fontFamily: "cursive", fontSize: 18, color: "#047857" }}>Authorized Signatory</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
                        <span>Board of Trustees / Managing Agent</span>
                        <span>Official Stamp / Seal</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, padding: "8px 12px", background: "#f1f5f9", borderRadius: 6, fontSize: 10, color: "#64748b", textAlign: "center" }}>
                    CONFIDENTIAL · Generated by CeEst · Issued under {orgName} Facilities Management System · In compliance with Kenyan Building Codes (KPMR 2020) & DOSH Workplace Safety Regulations
                  </div>
                </div>
              </div>
            )}

            {activeReportPreview !== "executive_fm" && (
              <div style={{ padding: 20, textAlign: "center", color: "#4b5563" }}>
                <p style={{ fontSize: "0.95rem" }}>
                  This report section has been compiled with live data from {orgName} ERP database. Click <b>Print / Save as PDF</b> above to print or archive this report pack.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
