"use client";

import { useState } from "react";
import { FacilityDashboard } from "../../types/facility.types";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Download, FileSpreadsheet } from "lucide-react";

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

export function ReportsView({ dashboard, organizationId }: { dashboard: FacilityDashboard; organizationId: string | null }) {
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const kpi = dashboard.kpis;
  const openWO = Number(kpi?.openWorkOrders ?? 0);
  const completedWO = Number(kpi?.completedToday ?? 0);
  const overdueWO = Number(kpi?.overdueWorkOrders ?? 0);
  const compliance = Number(kpi?.maintenanceCompliance ?? 0);

  const exports = [
    { type: "assets", title: "Asset register", description: "Current assets, categories, condition and property locations." },
    { type: "work-orders", title: "Work order register", description: "Maintenance workload, priority, ownership and status." },
    { type: "inspections", title: "Inspection register", description: "Scheduled and completed inspections with findings." },
    { type: "contractors", title: "Vendor and contractor register", description: "Approved service providers and contract details." },
  ];

  async function downloadReport(type: string, title: string) {
    if (!organizationId) return;
    setDownloading(type); setError("");
    try {
      const response = await apiFetch(`/facility/analytics/exports/?type=${type}`, {}, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, `${title} could not be exported.`));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `center-estates-${type}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${title} could not be exported.`);
    } finally { setDownloading(""); }
  }

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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
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
                <span key={item.label} style={{ alignItems: "center", color: "var(--text-primary)", display: "flex", fontSize: 12, fontWeight: 800, gap: 8 }}>
                  <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                  {item.label}
                  <b style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{item.count}</b>
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Gauge: Compliance Trend */}
        <article className="data-panel">
          <PanelHeader title="Compliance Trend" />
          <div className="fc-sla-gauge">
            <div className="donut" style={{ background: `conic-gradient(#22c55e 0% ${compliance}%, #edf0f5 ${compliance}% 100%)`, height: 120, width: 120, marginBottom: 10 }}>
              <strong style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{compliance}%</strong>
              <small style={{ color: "var(--text-primary)", fontWeight: 800 }}>{compliance >= 90 ? "On track" : "Needs attention"}</small>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "#edf0f5", borderRadius: 99, height: 4, marginBottom: 8, overflow: "hidden", width: 120 }}>
                <i style={{ background: "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${compliance}%` }} />
              </div>
              <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 800 }}>Target: 90%</span>
            </div>
          </div>
        </article>
      </div>

      <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Operational report exports</Typography>
          <Typography variant="body2" color="text.secondary">Exports use the current organization and selected property context. Open them in Excel or your reporting tool for further analysis.</Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.5 }}>
          {exports.map((report) => (
            <Paper key={report.type} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <FileSpreadsheet size={22} color="#15803d" aria-hidden="true" />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>{report.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 1.25 }}>{report.description}</Typography>
                  <Button size="small" variant="outlined" startIcon={<Download size={15} />} disabled={Boolean(downloading)} onClick={() => void downloadReport(report.type, report.title)}>
                    {downloading === report.type ? "Preparing…" : "Export CSV"}
                  </Button>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Paper>
    </>
  );
}
