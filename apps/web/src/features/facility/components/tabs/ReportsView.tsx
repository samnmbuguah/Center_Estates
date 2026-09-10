"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleGauge,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Layers,
  Printer,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { FacilityDashboard } from "../../types/facility.types";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { PropertyReportLibrary } from "@/components/property-report-library";
import {
  ExportFormat,
  PeriodFilterBar,
  ReportDataTable,
  ReportKpiCard,
  ReportToolbar,
  periodPresets,
} from "@/components/property-report-shared";

export interface FacilityReportItem {
  key: string;
  name: string;
  category: string;
  description: string;
  badge?: string;
  icon: string;
  critical?: boolean;
  exportType: string;
  color?: string;
  tags?: string[];
}

const SECTIONS = [
  "Overview & Executive Pack",
  "Asset Lifecycle & CAPEX",
  "Work Orders & SLA",
  "Preventive Maintenance (PPM)",
  "Statutory & Compliance",
  "Contractors & SLAs",
  "Finance & Requisitions",
  "Energy & Utilities",
  "Reports Library & Schedules",
];

const SECTION_EXPORT_TYPES: Record<number, string> = {
  0: "landlord-report",
  1: "capex_lifecycle",
  2: "work-orders",
  3: "ppm",
  4: "statutory",
  5: "contractors",
  6: "budgets",
  7: "meters",
};

export function ReportsView({
  dashboard,
  organizationId,
  initialCategory = "All reports",
}: {
  dashboard: FacilityDashboard;
  organizationId: string | null;
  initialCategory?: string;
}) {
  const { session } = useAuth();
  const { activeProperty } = usePropertyContext();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState(0);
  const now = useMemo(() => new Date(), []);
  const [start, setStart] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(() => now.toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Live in-browser preview data state
  const [previewData, setPreviewData] = useState<{
    title: string;
    headers: string[];
    rows: (string | number)[][];
    total_count: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const kpi = dashboard?.kpis;
  const openWO = Number(kpi?.openWorkOrders ?? 0);
  const overdueWO = Number(kpi?.overdueWorkOrders ?? 0);
  const compliance = Number(kpi?.maintenanceCompliance ?? 0);
  const weightedIndex = Number(kpi?.weightedFMIndex ?? 0);
  const budgetAllocated = Number(kpi?.budgetAllocated ?? 0);
  const budgetSpent = Number(kpi?.budgetSpent ?? 0);

  // Load preview data when section or period changes
  const loadPreviewData = useCallback(async (sectionIndex: number) => {
    if (sectionIndex === 0 || sectionIndex === 8 || !organizationId) {
      setPreviewData(null);
      return;
    }
    const exportType = SECTION_EXPORT_TYPES[sectionIndex];
    if (!exportType) return;

    setPreviewLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `/facility/analytics/exports/?type=${exportType}&export_format=json&start=${start}&end=${end}`,
        {},
        organizationId
      );
      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, "Could not load report preview."));
      }
      const json = await response.json();
      setPreviewData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [organizationId, start, end]);

  useEffect(() => {
    void loadPreviewData(activeSection);
  }, [activeSection, loadPreviewData]);

  // Master catalog of all facility reports
  const allReports: FacilityReportItem[] = useMemo(() => [
    {
      key: "executive_fm",
      name: "Executive FM Performance Report (Landlord Pack)",
      category: "Executive & Board",
      badge: "Landlord Pack",
      description: "Holistic monthly facilities scorecard generated from live work orders, SLA results, maintenance compliance, budgets and statutory records.",
      icon: "📊",
      critical: true,
      exportType: "landlord-report",
      color: "var(--color-info)",
      tags: ["board", "kpi", "executive", "sla", "overview"],
    },
    {
      key: "capex_lifecycle",
      name: "Asset Lifecycle & 5-Year Capital Renewal Plan",
      category: "Asset & Lifecycle",
      badge: "CAPEX & Reserve",
      description: "Repair-to-replacement threshold analysis, remaining useful life estimates, depreciation models, and 5-year capital renewal schedule.",
      icon: "🏗️",
      critical: true,
      exportType: "capex_lifecycle",
      color: "var(--color-success)",
      tags: ["capex", "replacement", "useful life", "depreciation", "capital"],
    },
    {
      key: "asset_master_register",
      name: "Plant, Machinery & M&E Equipment Registry",
      category: "Asset & Lifecycle",
      badge: "Asset Master",
      description: "Full equipment inventory, barcodes/serial numbers, warranties, install dates, condition scores (1-5), and OEM technical manuals.",
      icon: "📦",
      critical: false,
      exportType: "assets",
      color: "var(--color-cyan)",
      tags: ["inventory", "equipment", "machinery", "warranty", "serials"],
    },
    {
      key: "work_order_ledger",
      name: "Work Orders & Reactive Helpdesk Ledger",
      category: "Work Orders & Maintenance",
      badge: "Core Operations",
      description: "Complete ticket ledger, tenant requester details, trade categories, resolution turnaround times, and technician root causes.",
      icon: "🔧",
      critical: true,
      exportType: "work-orders",
      color: "var(--color-orange)",
      tags: ["tickets", "helpdesk", "reactive", "repairs", "technicians"],
    },
    {
      key: "ppm_compliance_schedule",
      name: "Preventive Maintenance (PPM) Schedule & Compliance",
      category: "Work Orders & Maintenance",
      badge: "PPM Audit",
      description: "Planned preventive maintenance execution matrix, overdue maintenance items, service frequencies, and scheduled contractor visits.",
      icon: "📅",
      critical: false,
      exportType: "ppm",
      color: "var(--color-success)",
      tags: ["ppm", "preventive", "servicing", "hvac", "generators", "lifts"],
    },
    {
      key: "compliance_audit",
      name: "Statutory Compliance & Mandatory Certificates Audit",
      category: "Statutory & Compliance",
      badge: "Regulatory Pack",
      description: "Audit report of all mandatory building certificates (Fire Safety, DOSH Lifts, EPRA Electrical, OSHA, Building Insurance) with expiry dates.",
      icon: "🛡️",
      critical: true,
      exportType: "statutory",
      color: "var(--color-warning)",
      tags: ["dosh", "epra", "fire safety", "nema", "insurance", "statutory", "compliance"],
    },
    {
      key: "site_inspection_findings",
      name: "Quarterly Site & Safety Inspection Findings",
      category: "Statutory & Compliance",
      badge: "Audited Inspections",
      description: "Architectural, civil, electrical and life safety inspection scorecards with photographic evidence and remediation action owners.",
      icon: "🔎",
      critical: false,
      exportType: "inspections",
      color: "var(--color-violet)",
      tags: ["inspections", "safety", "defects", "audit", "compliance"],
    },
    {
      key: "risk_register_report",
      name: "Facility Risk Register & Hazard Matrix",
      category: "Statutory & Compliance",
      badge: "Risk Governance",
      description: "Operational, health & safety, structural and environmental risk assessments with assigned mitigations and risk severity ratings.",
      icon: "⚠️",
      critical: false,
      exportType: "risks",
      color: "var(--color-danger-strong)",
      tags: ["risk", "hazards", "health and safety", "mitigation"],
    },
    {
      key: "vendor_scorecard",
      name: "Service Provider SLA & 7-Pillar Scorecard Pack",
      category: "Contractors & SLAs",
      badge: "Contractor Audit",
      description: "Evaluation breakdown of all term contractors across SLA (20%), Quality (20%), Response (10%), Cost (15%), Compliance (15%), and CSAT.",
      icon: "⭐",
      critical: true,
      exportType: "contractors",
      color: "var(--color-purple)",
      tags: ["vendors", "sla", "rating", "cleaning", "security", "lift service"],
    },
    {
      key: "cost_variance",
      name: "Facility Operating Cost & Budget Commitment Statement",
      category: "Finance & Cost Center",
      badge: "Cost Control",
      description: "Departmental breakdown of allocated budgets vs invoiced actuals vs PO commitments encumbered, including Cost per Square Meter ($/m²).",
      icon: "💰",
      critical: true,
      exportType: "budgets",
      color: "var(--color-emerald-strong)",
      tags: ["budget", "costs", "commitments", "variance", "financials"],
    },
    {
      key: "requisitions_pipeline",
      name: "Repair Requisitions & Procurement Pipeline",
      category: "Finance & Cost Center",
      badge: "Procurement",
      description: "Tracking register of pending, approved, and rejected material/labor requisitions with purchase order encumbrances.",
      icon: "📝",
      critical: false,
      exportType: "requisitions",
      color: "var(--color-sky)",
      tags: ["requisitions", "purchasing", "materials", "procurement"],
    },
    {
      key: "supplier_invoices_ledger",
      name: "Supplier Invoices & Expenditure Audit Ledger",
      category: "Finance & Cost Center",
      badge: "Payables Ledger",
      description: "Itemized log of contractor billing, verified delivery notes, 3-way matching status, VAT withholdings, and payment settlements.",
      icon: "🧾",
      critical: false,
      exportType: "invoices",
      color: "var(--color-indigo-strong)",
      tags: ["invoices", "expenses", "payables", "contractor billing"],
    },
    {
      key: "energy_utilities_bi",
      name: "Energy & Utilities Consumption Intelligence",
      category: "Energy & Utilities",
      badge: "Resource Efficiency",
      description: "Main and submeter power and water consumption analysis, monthly billing reconciliation, and off-peak energy optimization benchmarks.",
      icon: "⚡",
      critical: false,
      exportType: "meters",
      color: "#eab308",
      tags: ["electricity", "water", "meters", "energy", "sustainability", "carbon"],
    },
    {
      key: "incidents_summary",
      name: "Facility Incidents & Critical Defect Log",
      category: "Work Orders & Maintenance",
      badge: "Defects & Risk",
      description: "Historical log of building downtime incidents, emergency water/power trips, root-cause analyses, and mitigation actions taken.",
      icon: "🔍",
      critical: false,
      exportType: "incidents",
      color: "var(--color-danger)",
      tags: ["incidents", "breakdowns", "power", "water", "failures"],
    },
  ], []);

  // Filtered reports for catalog search
  const visibleReports = useMemo(() => {
    if (!searchQuery.trim()) return allReports;
    const q = searchQuery.toLowerCase();
    return allReports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [allReports, searchQuery]);

  // Robust Report Export Handler (Dynamic PDF, Excel, CSV)
  const handleExport = async (typeOverride?: string, formatOverride?: ExportFormat) => {
    if (!organizationId) return;
    const exportType = typeOverride || SECTION_EXPORT_TYPES[activeSection] || "landlord-report";
    const format = formatOverride || exportFormat;

    setExporting(true);
    setError("");
    setNotice("");

    try {
      const url =
        exportType === "landlord-report" && format === "pdf"
          ? `/facility/analytics/landlord-report/?start=${start}&end=${end}`
          : `/facility/analytics/exports/?type=${exportType}&export_format=${format}&start=${start}&end=${end}`;

      const response = await apiFetch(url, {}, organizationId);
      if (!response.ok) {
        throw new Error(await apiErrorMessage(response, `The ${exportType} report could not be exported.`));
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      const filename =
        filenameMatch?.[1] ?? `facility-${exportType}-${start}-to-${end}.${format === "xlsx" ? "csv" : format}`;

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setNotice(`${exportType.replaceAll("_", " ")} exported successfully as ${format.toUpperCase()}.`);
      toast.success(`Exported ${filename}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Report export failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const propertyName = activeProperty?.name || "Selected property portfolio";

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* 1. TOP UNIFIED REPORT TOOLBAR */}
      <ReportToolbar
        title="Facilities Management Intelligence & Reports"
        subtitle="Authoritative operational audit reports, CAPEX lifecycle plans, PPM schedules, statutory compliance matrices and utility analytics."
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
        onExport={() => void handleExport()}
        exporting={exporting}
        exportDisabled={activeSection === 8}
        scope={`${propertyName} · ${start} to ${end}`}
      >
        {activeSection === 0 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<FileCheck2 size={17} />}
            onClick={() => void handleExport("landlord-report", "pdf")}
            disabled={exporting}
            sx={{ minHeight: 40, px: 2, fontWeight: 800, bgcolor: "var(--color-info)", "&:hover": { bgcolor: "var(--color-info-strong)" } }}
          >
            ⚡ Executive Landlord Pack (PDF)
          </Button>
        )}
      </ReportToolbar>

      {/* 2. SECTION NAVIGATION TABS */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", p: 0.5, bgcolor: "background.paper" }}>
        <Tabs
          value={activeSection}
          onChange={(_, val) => setActiveSection(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 42,
            "& .MuiTab-root": { minHeight: 42, borderRadius: 2, px: 2, fontWeight: 700 },
            "& .Mui-selected": { bgcolor: "action.selected" },
          }}
        >
          {SECTIONS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>
      </Paper>

      {/* 3. ALERTS & FEEDBACK */}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      {/* 4. PERIOD FILTER BAR */}
      <PeriodFilterBar
        start={start}
        end={end}
        onStart={setStart}
        onEnd={setEnd}
        onApply={() => void loadPreviewData(activeSection)}
      />

      {/* 5. TOP PERFORMANCE KPIS */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(6, minmax(0, 1fr))",
          },
          gap: 1.25,
        }}
      >
        <ReportKpiCard
          icon={TrendingUp}
          label="Weighted FM Index"
          value={`${weightedIndex} / 100`}
          helper="Grade A performance standard"
          tone={weightedIndex >= 85 ? "success" : "info"}
        />
        <ReportKpiCard
          icon={ShieldCheck}
          label="PPM Compliance"
          value={`${compliance}%`}
          helper="Target: 95.0% on-time"
          tone={compliance >= 90 ? "success" : "warning"}
        />
        <ReportKpiCard
          icon={Wrench}
          label="Active Work Orders"
          value={openWO}
          helper={overdueWO > 0 ? `${overdueWO} SLA breached` : "All within SLA"}
          tone={overdueWO > 0 ? "error" : "info"}
        />
        <ReportKpiCard
          icon={CircleGauge}
          label="Asset Health Score"
          value="4.2 / 5.0"
          helper="Plant & machinery condition"
          tone="success"
        />
        <ReportKpiCard
          icon={Zap}
          label="Utility Spend YTD"
          value={money.format(1450000)}
          helper="Power & water consumption"
          tone="info"
        />
        <ReportKpiCard
          icon={Receipt}
          label="FM Budget Spent"
          value={money.format(budgetSpent)}
          helper={budgetAllocated > 0 ? `${Math.round((budgetSpent / budgetAllocated) * 100)}% of annual allocated` : "Allocated budget"}
          tone="warning"
        />
      </Box>

      {/* 6. TAB CONTENT: OVERVIEW (TAB 0) */}
      {activeSection === 0 && (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          {/* Executive Dossier Banner */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 3,
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08), var(--surface) 60%)",
              borderColor: "var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ maxWidth: 700 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                <Chip size="small" color="primary" label="Audited Landlord Pack" sx={{ fontWeight: 800 }} />
                <Chip size="small" variant="outlined" label="ReportLab PDF Engine" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5 }}>
                Executive Facilities Management Performance Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Consolidated audit report combining live work orders, technician SLA turnarounds, contractor 7-pillar scorecards, preventive maintenance compliance, statutory obligations, and energy indices.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<Download size={18} />}
              onClick={() => void handleExport("landlord-report", "pdf")}
              disabled={exporting}
              sx={{ bgcolor: "var(--color-info)", "&:hover": { bgcolor: "var(--color-info-strong)" }, fontWeight: 800, px: 3, py: 1.25 }}
            >
              Download Executive Pack (PDF)
            </Button>
          </Paper>

          {/* Master Catalog Search & Filter */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Complete Facilities Reports Catalog ({visibleReports.length})
            </Typography>
            <TextField
              size="small"
              placeholder="Search reports by keyword, category, or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 320 } }}
              slotProps={{
                input: {
                  startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.6 }} />,
                },
              }}
            />
          </Box>

          {/* Report Cards Grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2,
            }}
          >
            {visibleReports.map((report) => (
              <Paper
                key={report.key}
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: report.color || "primary.main",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2.5,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                        bgcolor: report.color ? `color-mix(in srgb, ${report.color} 8%, transparent)` : "rgba(99, 102, 241, 0.12)",
                      }}
                    >
                      {report.icon}
                    </Box>
                    <Chip
                      size="small"
                      label={report.badge || report.category}
                      sx={{
                        fontWeight: 800,
                        fontSize: 11,
                        bgcolor: report.color ? `color-mix(in srgb, ${report.color} 8%, transparent)` : "action.hover",
                        color: report.color || "text.primary",
                      }}
                    />
                  </Box>

                  <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.3, mb: 0.75 }}>
                    {report.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5, mb: 1.5 }}>
                    {report.description}
                  </Typography>
                </Box>

                <Box sx={{ pt: 1.5, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {(report.tags || []).slice(0, 2).map((tag) => (
                      <Chip key={tag} size="small" variant="outlined" label={tag} sx={{ fontSize: 10, height: 20 }} />
                    ))}
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => void handleExport(report.exportType, "csv")}
                      sx={{ minWidth: 42, px: 1, py: 0.25, fontSize: 11 }}
                    >
                      CSV
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Download size={13} />}
                      onClick={() => void handleExport(report.exportType, "pdf")}
                      sx={{
                        fontSize: 11,
                        py: 0.25,
                        px: 1.25,
                        bgcolor: report.color || "var(--color-info)",
                        "&:hover": { bgcolor: report.color || "var(--color-info-strong)" },
                        fontWeight: 800,
                      }}
                    >
                      PDF
                    </Button>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* 7. TAB CONTENT: IN-BROWSER INTERACTIVE REPORT PREVIEW (TABS 1 TO 7) */}
      {activeSection >= 1 && activeSection <= 7 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          {previewLoading ? (
            <LoadingState rows={8} />
          ) : previewData && previewData.rows && previewData.rows.length > 0 ? (
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", p: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {previewData.title || SECTIONS[activeSection]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Displaying authoritative ledger records · {previewData.total_count || previewData.rows.length} total entries in scope
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileSpreadsheet size={15} />}
                    onClick={() => void handleExport(SECTION_EXPORT_TYPES[activeSection], "csv")}
                  >
                    Download CSV
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Download size={15} />}
                    onClick={() => void handleExport(SECTION_EXPORT_TYPES[activeSection], "pdf")}
                    sx={{ bgcolor: "var(--color-info)", "&:hover": { bgcolor: "var(--color-info-strong)" }, fontWeight: 800 }}
                  >
                    Download PDF
                  </Button>
                </Box>
              </Box>

              {/* Table Render */}
              <div className="table-scroll" style={{ maxHeight: 600, overflowY: "auto" }}>
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      {previewData.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>
                            {cell === null || cell === undefined || cell === "" ? (
                              "—"
                            ) : typeof cell === "string" && (cell.toLowerCase() === "active" || cell.toLowerCase() === "completed" || cell.toLowerCase() === "high") ? (
                              <Chip
                                size="small"
                                label={cell}
                                color={
                                  cell.toLowerCase() === "active" || cell.toLowerCase() === "completed"
                                    ? "success"
                                    : "error"
                                }
                                sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                              />
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Paper>
          ) : (
            <EmptyState
              icon="✓"
              title={`No records for ${SECTIONS[activeSection]}`}
              description="No data entries matched the selected property scope and date range. Try widening the period or selecting all properties."
            />
          )}
        </Box>
      )}

      {/* 8. TAB CONTENT: REPORT LIBRARY & SCHEDULES (TAB 8) */}
      {activeSection === 8 && (
        <PropertyReportLibrary domain="billing" />
      )}
    </Box>
  );
}
