"use client";

import { FacilityDashboard } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
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

export function ReportsView({ dashboard }: { dashboard: FacilityDashboard }) {
  const kpi = dashboard.kpis;
  const openWO = Number(kpi?.openWorkOrders ?? 0);
  const completedWO = Number(kpi?.completedToday ?? 18);
  const overdueWO = Number(kpi?.overdueWorkOrders ?? 0);
  const compliance = Number(kpi?.maintenanceCompliance ?? 92);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const costData = [3.2, 3.8, 4.1, 3.6, 4.25, 3.9, 4.5];
  const maxCost = Math.max(...costData);

  const recentReports = [
    { name: "Monthly KPI Summary", date: "01 Jun 2026", generated: "Admin User", type: "KPI", status: "ready" },
    { name: "PPM Compliance Report", date: "28 May 2026", generated: "James Kariuki", type: "Compliance", status: "ready" },
    { name: "Work Order Analysis", date: "25 May 2026", generated: "Admin User", type: "Analysis", status: "ready" },
    { name: "Contractor Performance", date: "22 May 2026", generated: "Mary Wanjiku", type: "Performance", status: "ready" },
    { name: "Sustainability Report", date: "20 May 2026", generated: "Admin User", type: "Sustainability", status: "ready" },
  ];

  return (
    <>
      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${compliance}%`} sub="Schedule compliance" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="WOs Completed" value={String(completedWO)} sub="This month" />
        <FcKpiCard icon="⏱" iconBg="#dbeafe" iconColor="#2563eb" label="Avg Response" value="—" sub="No data available" />
        <FcKpiCard icon="💰" iconBg="#ffedd5" iconColor="#ea580c" label="Cost / WO" value="—" sub="No data available" />
        <FcKpiCard icon="🛡" iconBg="#f0fdf4" iconColor="#15803d" label="Compliance Score" value="—" sub="No data available" />
        <FcKpiCard icon="⚙" iconBg="#fdf4ff" iconColor="#9333ea" label="Asset Reliability" value="—" sub="No data available" />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Satisfaction" value="—" sub="No data available" />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
        {/* Donut: Work Orders by Status */}
        <article className="data-panel">
          <PanelHeader title="Work Order Status Breakdown" />
          <div style={{ padding: "18px" }}>
            <div className="fc-donut-lg" style={{ background: `conic-gradient(#22c55e 0% ${completedWO / Math.max(completedWO + openWO + overdueWO, 1) * 100}%, #3b82f6 ${completedWO / Math.max(completedWO + openWO + overdueWO, 1) * 100}% ${(completedWO + openWO) / Math.max(completedWO + openWO + overdueWO, 1) * 100}%, #ef4444 ${(completedWO + openWO) / Math.max(completedWO + openWO + overdueWO, 1) * 100}% 100%)`, height: 140, width: 140, margin: "0 auto 16px" }}>
              <strong>{completedWO + openWO + overdueWO}</strong>
              <small>Total</small>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { color: "#22c55e", label: "Completed", count: completedWO },
                { color: "#3b82f6", label: "Open / In Progress", count: openWO },
                { color: "#ef4444", label: "Overdue", count: overdueWO },
              ].map((item) => (
                <span key={item.label} style={{ alignItems: "center", color: "#000000", display: "flex", fontSize: 12, fontWeight: 800, gap: 8 }}>
                  <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                  {item.label}
                  <b style={{ marginLeft: "auto", color: "#000000" }}>{item.count}</b>
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Bar chart: Monthly Maintenance Cost */}
        <article className="data-panel">
          <PanelHeader title="Maintenance Cost Trend (KES)" />
          <div style={{ padding: "18px" }}>
            <div style={{ alignItems: "flex-end", display: "flex", gap: 12, height: 140 }}>
              {months.map((m, i) => (
                <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#000000" }}>{costData[i]}M</span>
                  <div style={{ background: "#e23b3b", borderRadius: "4px 4px 0 0", height: `${(costData[i] / maxCost) * 100}%`, minHeight: 4, width: "100%" }} />
                  <span style={{ color: "#000000", fontSize: 11, fontWeight: 800 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Gauge: Compliance Trend */}
        <article className="data-panel">
          <PanelHeader title="Compliance Trend" />
          <div className="fc-sla-gauge">
            <div className="donut" style={{ background: `conic-gradient(#22c55e 0% ${compliance}%, #edf0f5 ${compliance}% 100%)`, height: 120, width: 120, marginBottom: 10 }}>
              <strong style={{ fontSize: 20, fontWeight: 900, color: "#000000" }}>{compliance}%</strong>
              <small style={{ color: "#000000", fontWeight: 800 }}>On Track</small>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "#edf0f5", borderRadius: 99, height: 4, marginBottom: 8, overflow: "hidden", width: 120 }}>
                <i style={{ background: "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${compliance}%` }} />
              </div>
              <span style={{ color: "#000000", fontSize: 12, fontWeight: 800 }}>Target: 90%</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", padding: "12px 18px" }}>
            <button style={{ background: "none", border: 0, color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>View Detailed Report →</button>
          </div>
        </article>
      </div>

      {/* Recent Reports */}
      <article className="data-panel" style={{ marginTop: 16 }}>
        <div className="fc-table-toolbar">
          <span style={{ color: "#000000", fontWeight: 800, fontSize: 14 }}>Recent Reports</span>
          <button className="fc-toolbar-btn" style={{ fontWeight: 800 }}>View All Reports</button>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Type</th>
                <th>Generated</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((r, i) => (
                <tr key={i}>
                  <td><strong style={{ fontSize: 13, fontWeight: 800, color: "#000000" }}>{r.name}</strong></td>
                  <td><FcStatus value={r.type.toLowerCase()} /></td>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "#000000" }}>{r.generated}</td>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "#000000" }}>{r.date}</td>
                  <td><FcStatus value={r.status} /></td>
                  <td>
                    <button style={{ background: "#ffffff", border: "1px solid #94a3b8", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#000000", padding: "4px 10px" }}>↓ Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
