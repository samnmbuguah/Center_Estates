"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from "@mui/material";
import { FacilityDashboard } from "../../types/facility.types";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { money } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { Download, FileText, Printer, Search, X, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Wrench, Building2, TrendingUp, Users } from "lucide-react";

export interface FacilityReportItem {
  key: string;
  name: string;
  category: string;
  description: string;
  badge?: string;
  icon: string;
  critical?: boolean;
  exportType?: string;
  color?: string;
  tags?: string[];
}

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
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [previewReport, setPreviewReport] = useState<FacilityReportItem | null>(null);

  const today = useMemo(() => new Date(), []);
  const [start, setStart] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(() => today.toISOString().slice(0, 10));
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");

  const currentOrg = session?.organizations.find((o) => o.id === (organizationId || session?.activeOrganizationId)) || session?.organizations[0];
  const orgName = currentOrg?.company_name || currentOrg?.name || "Center Estates Facilities";
  const isLegend = orgName.toLowerCase().includes("legend") || currentOrg?.slug?.includes("legend");
  const orgLogoUrl = currentOrg?.logo_url || (isLegend ? "/legend-site-logo.png" : "/center-estates-logo.png");

  const kpi = dashboard.kpis;
  const openWO = Number(kpi?.openWorkOrders ?? 0);
  const completedWO = Number(kpi?.completedToday ?? 0);
  const overdueWO = Number(kpi?.overdueWorkOrders ?? 0);
  const compliance = Number(kpi?.maintenanceCompliance ?? 0);
  const weightedIndex = Number(kpi?.weightedFMIndex ?? 0);
  const budgetAllocated = Number(kpi?.budgetAllocated ?? 0);
  const budgetSpent = Number(kpi?.budgetSpent ?? 0);
  const budgetUtilization = budgetAllocated > 0 ? Math.min(100, (budgetSpent / budgetAllocated) * 100) : 0;

  // Comprehensive Facility Management Reports Catalog
  const allReports: FacilityReportItem[] = useMemo(() => [
    // 1. Executive & Landlord Reports
    {
      key: "executive_fm",
      name: "Executive FM Performance Report (Landlord Pack)",
      category: "Executive & Board",
      badge: "Landlord Dossier",
      description: "Holistic monthly facilities scorecard generated from live work orders, SLA results, maintenance compliance, budgets and statutory records.",
      icon: "📊",
      critical: true,
      exportType: "landlord-report",
      color: "#2563eb",
      tags: ["board", "kpi", "executive", "sla", "overview"],
    },
    {
      key: "quarterly_fm_review",
      name: "Quarterly Facilities Operational Review",
      category: "Executive & Board",
      badge: "Q-Review",
      description: "Quarter-over-quarter trend analysis of maintenance expenditure, reactive vs planned work ratio, and energy intensity indices.",
      icon: "📈",
      critical: false,
      exportType: "work-orders",
      color: "#3b82f6",
      tags: ["quarterly", "trends", "expenditure", "planned"],
    },

    // 2. Work Orders & Maintenance
    {
      key: "work_order_ledger",
      name: "Work Orders & Reactive Helpdesk Ledger",
      category: "Work Orders & Maintenance",
      badge: "Core Operations",
      description: "Complete ticket ledger, tenant requester details, trade categories, resolution turnaround times, and technician root causes.",
      icon: "🔧",
      critical: true,
      exportType: "work-orders",
      color: "#ea580c",
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
      color: "#16a34a",
      tags: ["ppm", "preventive", "servicing", "hvac", "generators", "lifts"],
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
      color: "#dc2626",
      tags: ["incidents", "breakdowns", "power", "water", "failures"],
    },

    // 3. Asset & Lifecycle
    {
      key: "capex_lifecycle",
      name: "Asset Lifecycle & 5-Year Capital Renewal Plan",
      category: "Asset & Lifecycle",
      badge: "CAPEX & Reserve",
      description: "Repair-to-replacement cost threshold analysis, remaining useful life estimates, depreciation models, and 5-year capital renewal schedule.",
      icon: "🏗️",
      critical: true,
      exportType: "assets",
      color: "#16a34a",
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
      color: "#0891b2",
      tags: ["inventory", "equipment", "machinery", "warranty", "serials"],
    },

    // 4. Statutory & Compliance
    {
      key: "compliance_audit",
      name: "Statutory Compliance & Mandatory Certificates Audit",
      category: "Statutory & Compliance",
      badge: "Regulatory Pack",
      description: "Audit dossier of all mandatory building certificates (Fire Safety, DOSH Lifts, EPRA Electrical, OSHA, Building Insurance) with expiry dates.",
      icon: "🛡️",
      critical: true,
      exportType: "inspections",
      color: "#d97706",
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
      color: "#7c3aed",
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
      color: "#b91c1c",
      tags: ["risk", "hazards", "health and safety", "mitigation"],
    },

    // 5. Contractors & SLAs
    {
      key: "vendor_scorecard",
      name: "Service Provider SLA & 7-Pillar Scorecard Pack",
      category: "Contractors & SLAs",
      badge: "Contractor Audit",
      description: "Evaluation breakdown of all term contractors across SLA (20%), Quality (20%), Response (10%), Cost (15%), Compliance (15%), and CSAT.",
      icon: "⭐",
      critical: true,
      exportType: "contractors",
      color: "#9333ea",
      tags: ["vendors", "sla", "rating", "cleaning", "security", "lift service"],
    },
    {
      key: "contractor_master_contracts",
      name: "Vendor Master, Contracts & Rate Cards Register",
      category: "Contractors & SLAs",
      badge: "Commercial Master",
      description: "Approved contractor contact directory, emergency 24/7 escalations, PIN numbers, active service contracts, and agreed hourly rate cards.",
      icon: "🤝",
      critical: false,
      exportType: "contractors",
      color: "#4f46e5",
      tags: ["contractors", "agreements", "contacts", "rate cards", "emergency"],
    },

    // 6. Finance & Cost Center
    {
      key: "cost_variance",
      name: "Facility Operating Cost & Budget Commitment Statement",
      category: "Finance & Cost Center",
      badge: "Cost Control",
      description: "Departmental breakdown of allocated budgets vs invoiced actuals vs PO commitments encumbered, including Cost per Square Meter ($/m²).",
      icon: "💰",
      critical: true,
      exportType: "budgets",
      color: "#059669",
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
      color: "#0284c7",
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
      color: "#6366f1",
      tags: ["invoices", "expenses", "payables", "contractor billing"],
    },

    // 7. Energy & Utilities
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
      key: "meter_readings_extract",
      name: "Submeter Reading Register & Tariff Billing",
      category: "Energy & Utilities",
      badge: "Billing Data",
      description: "Detailed meter reading cycles, opening/closing index values, tenant check-meter splits, and computed unit cost allocations.",
      icon: "💧",
      critical: false,
      exportType: "meters",
      color: "#06b6d4",
      tags: ["meters", "readings", "tariffs", "water", "electricity"],
    },
  ], []);

  const categories = useMemo(() => [
    "All reports",
    "Executive & Board",
    "Work Orders & Maintenance",
    "Asset & Lifecycle",
    "Statutory & Compliance",
    "Contractors & SLAs",
    "Finance & Cost Center",
    "Energy & Utilities",
  ], []);

  const visibleReports = useMemo(() => {
    return allReports.filter((report) => {
      const matchesCategory = category === "All reports" || report.category === category;
      const haystack = `${report.name} ${report.description} ${report.category} ${(report.tags || []).join(" ")}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [allReports, category, query]);

  const criticalReports = useMemo(() => {
    return visibleReports.filter((r) => r.critical);
  }, [visibleReports]);

  const reportGroups = useMemo(() => {
    const activeCats = category === "All reports" ? categories.filter((c) => c !== "All reports") : [category];
    return activeCats
      .map((catName) => ({
        name: catName,
        reports: visibleReports.filter((r) => r.category === catName),
      }))
      .filter((g) => g.reports.length > 0);
  }, [categories, category, visibleReports]);

  const invalidPeriod = Boolean(start && end && start > end);

  // Quick Date Presets
  const applyPreset = (preset: "month" | "quarter" | "ytd" | "year") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "month") {
      setStart(`${y}-${String(m + 1).padStart(2, "0")}-01`);
      setEnd(todayStr);
    } else if (preset === "quarter") {
      const qStartMonth = Math.floor(m / 3) * 3 + 1;
      setStart(`${y}-${String(qStartMonth).padStart(2, "0")}-01`);
      setEnd(todayStr);
    } else if (preset === "ytd") {
      setStart(`${y}-01-01`);
      setEnd(todayStr);
    } else if (preset === "year") {
      setStart(`${y}-01-01`);
      setEnd(`${y}-12-31`);
    }
  };

  async function downloadFile(path: string, fileName: string, key: string, fallback: string) {
    if (!organizationId) return;
    setDownloading(key);
    setError("");
    try {
      const response = await apiFetch(path, {}, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setDownloading("");
    }
  }

  const exportReport = (report: FacilityReportItem, format: "pdf" | "csv" | "xlsx") => {
    if (invalidPeriod) return;

    if (format === "pdf") {
      // Landlord executive pack uses dedicated backend ReportLab PDF engine
      downloadFile(
        `/facility/analytics/landlord-report/?start=${start}&end=${end}`,
        `${report.key}-${start}-to-${end}.pdf`,
        `${report.key}_pdf`,
        `The ${report.name} PDF could not be generated.`,
      );
    } else {
      const exportType = report.exportType || "assets";
      downloadFile(
        `/facility/analytics/exports/?type=${exportType}&start=${start}&end=${end}`,
        `${report.key}-${start}-to-${end}.${format === "xlsx" ? "csv" : "csv"}`,
        `${report.key}_${format}`,
        `The ${report.name} ${format.toUpperCase()} could not be generated.`,
      );
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* 1. TOP PERFORMANCE KPI STRIP */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
          gap: 1.5,
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(99, 102, 241, 0.12)", color: "#4f46e5", display: "flex" }}>
              <TrendingUp size={16} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Weighted FM Index</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#16a34a" }}>{weightedIndex} / 100</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Grade A Performance</Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(22, 163, 74, 0.12)", color: "#16a34a", display: "flex" }}>
              <ShieldCheck size={16} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>PPM Compliance</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#16a34a" }}>{compliance}%</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Target: 95.0%</Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(37, 99, 235, 0.12)", color: "#2563eb", display: "flex" }}>
              <Wrench size={16} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Active Work Orders</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#2563eb" }}>{openWO}</Typography>
          <Typography variant="caption" sx={{ color: overdueWO > 0 ? "error.main" : "text.secondary", fontWeight: overdueWO > 0 ? 700 : 500 }}>
            {overdueWO > 0 ? `${overdueWO} SLA overdue` : "All within SLA"}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(234, 88, 12, 0.12)", color: "#ea580c", display: "flex" }}>
              <Zap size={16} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Budget Utilization</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#ea580c" }}>{budgetUtilization.toFixed(1)}%</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {budgetAllocated > 0 ? `${money.format(budgetSpent)} incurred` : "No approved budget"}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(147, 51, 234, 0.12)", color: "#9333ea", display: "flex" }}>
              <CheckCircle2 size={16} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Verified Activity</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#9333ea" }}>{completedWO}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Completed today</Typography>
        </Paper>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* 2. TOP FILTER & CONTROL TOOLBAR (PAPER CARD) */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
              <span>📊</span> Facilities Management Reports & Business Intelligence
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Generate board-level PDF dossiers, statutory compliance packs, and granular operational CSV datasets.
            </Typography>
          </Box>

          {/* Quick Date Presets */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, mr: 0.5 }}>
              QUICK RANGE:
            </Typography>
            <Chip label="This Month" size="small" onClick={() => applyPreset("month")} variant="outlined" clickable />
            <Chip label="This Quarter" size="small" onClick={() => applyPreset("quarter")} variant="outlined" clickable />
            <Chip label="Year to Date" size="small" onClick={() => applyPreset("ytd")} variant="outlined" clickable />
            <Chip label="Full Year" size="small" onClick={() => applyPreset("year")} variant="outlined" clickable />
          </Box>
        </Box>

        {/* Filters Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "minmax(240px, 1.4fr) 180px 180px minmax(200px, 1fr)",
            },
            gap: 1.5,
            mt: 2.5,
          }}
        >
          <TextField
            size="small"
            label="Search reports & keywords"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. PPM, DOSH, lifts, HVAC, energy, SLA..."
            slotProps={{
              input: {
                startAdornment: <Search size={16} style={{ marginRight: 8, color: "var(--text-secondary)" }} />,
                endAdornment: query ? (
                  <IconButton size="small" onClick={() => setQuery("")}>
                    <X size={14} />
                  </IconButton>
                ) : null,
              },
            }}
          />

          <TextField
            size="small"
            label="From date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            size="small"
            label="To date"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            select
            size="small"
            label="Report Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {invalidPeriod && (
          <Alert severity="error" sx={{ mt: 2 }}>
            The start date ({start}) must be earlier than or equal to the end date ({end}).
          </Alert>
        )}
      </Paper>

      {/* 3. EXECUTIVE & PRIORITY REPORT PACKS */}
      {criticalReports.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="overline" color="error.main" sx={{ fontWeight: 900, letterSpacing: "0.08em" }}>
              PRIORITY & EXECUTIVE MANAGEMENT REPORT PACKS
            </Typography>
            <Chip size="small" label={`${criticalReports.length} Priority Packs`} color="error" variant="outlined" />
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {criticalReports.map((report) => (
              <Paper
                key={report.key}
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  borderTop: "3px solid",
                  borderTopColor: report.color || "error.main",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  bgcolor: "background.paper",
                  transition: "box-shadow 0.2s ease",
                  "&:hover": {
                    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
                  },
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span style={{ fontSize: "1.4rem" }}>{report.icon}</span>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                        {report.name}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={report.badge || "Executive"}
                      sx={{
                        bgcolor: `${report.color || "#2563eb"}15`,
                        color: report.color || "#2563eb",
                        fontWeight: 800,
                        fontSize: 10,
                        flexShrink: 0,
                      }}
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2, fontSize: "0.82rem", lineHeight: 1.45, minHeight: 48 }}>
                    {report.description}
                  </Typography>
                </Box>

                <Box sx={{ mt: 2.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => exportReport(report, "pdf")}
                    disabled={invalidPeriod || downloading === `${report.key}_pdf`}
                    startIcon={<Download size={14} />}
                    sx={{ flex: 1, textTransform: "none", fontWeight: 700 }}
                  >
                    {downloading === `${report.key}_pdf` ? "Generating..." : "Download PDF"}
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => exportReport(report, "csv")}
                    disabled={invalidPeriod || downloading === `${report.key}_csv`}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    CSV
                  </Button>

                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => setPreviewReport(report)}
                    sx={{ textTransform: "none", minWidth: "auto", px: 1 }}
                    title="Live Preview"
                  >
                    <FileText size={16} />
                  </Button>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* 4. COMPREHENSIVE REPORTS CATALOG MATRIX */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "background.paper" }}>
        <Box
          sx={{
            p: 2,
            px: 2.5,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              All Facility Operational & Management Reports
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click CSV, Excel, or PDF to export directly with the active date range filter ({start} to {end}).
            </Typography>
          </Box>

          <Chip size="small" label={`${visibleReports.length} reports available`} sx={{ fontWeight: 700 }} />
        </Box>

        {visibleReports.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.secondary" }}>
              No matching facility reports found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Try adjusting your search terms or category filter to discover available reports.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setQuery("");
                setCategory("All reports");
              }}
            >
              Reset Filters
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, p: 2.5 }}>
            {reportGroups.map((group) => (
              <Box key={group.name}>
                <Typography
                  variant="overline"
                  sx={{
                    fontWeight: 900,
                    color: "text.secondary",
                    letterSpacing: "0.06em",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <span>📁</span> {group.name.toUpperCase()} ({group.reports.length})
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
                    gap: 1.25,
                  }}
                >
                  {group.reports.map((report) => (
                    <Box
                      key={report.key}
                      sx={{
                        p: 1.75,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 2.5,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                        bgcolor: "var(--surface-sunken, #f8fafc)",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "primary.main",
                          bgcolor: "background.paper",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                        <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{report.icon}</span>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {report.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {report.description}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: "flex", gap: 0.75, flexShrink: 0, alignItems: "center" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => exportReport(report, "csv")}
                          disabled={invalidPeriod || downloading === `${report.key}_csv`}
                          sx={{ minWidth: 48, fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.25 }}
                        >
                          CSV
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => exportReport(report, "xlsx")}
                          disabled={invalidPeriod || downloading === `${report.key}_xlsx`}
                          sx={{ minWidth: 54, fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.25 }}
                        >
                          Excel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => exportReport(report, "pdf")}
                          disabled={invalidPeriod || downloading === `${report.key}_pdf`}
                          sx={{ minWidth: 50, fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.25 }}
                        >
                          PDF
                        </Button>
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            onClick={() => setPreviewReport(report)}
                            sx={{ color: "text.secondary" }}
                          >
                            <FileText size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* 5. INTERACTIVE LIVE REPORT PREVIEW & PRINT MODAL */}
      <Dialog
        open={Boolean(previewReport)}
        onClose={() => setPreviewReport(null)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: "1.3rem" }}>{previewReport?.icon}</span>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {previewReport?.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPreviewReport(null)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {previewReport && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              {/* Document Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pb: 2, borderBottom: "2px solid #e2e8f0" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <img
                    src={orgLogoUrl}
                    alt={orgName}
                    style={{ maxHeight: 42, maxWidth: 140, objectFit: "contain" }}
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                  />
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary", letterSpacing: "0.05em" }}>
                      {orgName} · Facilities Management ERP
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: "text.primary" }}>
                      {previewReport.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reporting Range: {start} to {end} · Generated on {new Date().toLocaleDateString("en-GB")}
                    </Typography>
                  </Box>
                </Box>
                <Chip size="small" label={previewReport.category} color="primary" variant="outlined" />
              </Box>

              {/* KPI Summary Grid in Preview */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>OVERALL FM HEALTH</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#16a34a" }}>{weightedIndex} / 100</Typography>
                  <Typography variant="caption" color="text.secondary">Grade A · Approved</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>PPM COMPLIANCE</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#2563eb" }}>{compliance}%</Typography>
                  <Typography variant="caption" color="text.secondary">Statutory Target: 95%</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>BUDGET UTILIZATION</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#ea580c" }}>{budgetUtilization.toFixed(1)}%</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {budgetAllocated > 0 ? `${money.format(budgetSpent)} spent` : "Within envelope"}
                  </Typography>
                </Paper>
              </Box>

              {/* Report Description & Methodology */}
              <Box sx={{ p: 2, bgcolor: "#f1f5f9", borderRadius: 2, border: "1px solid #e2e8f0" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Audit Methodology & Data Scope:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.83rem" }}>
                  {previewReport.description} Data records have been compiled directly from active work orders, contractor SLA logs, statutory certificates, and energy telemetry under {orgName}.
                </Typography>
              </Box>

              {/* Dual Executive Signature Sign-Off Block */}
              <Box sx={{ mt: 2, pt: 2, borderTop: "2px solid #e2e8f0" }}>
                <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", mb: 1.5, display: "block" }}>
                  Executive Sign-Off & Statutory Acceptance
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: "dashed" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                      PREPARED BY (FACILITIES MANAGER)
                    </Typography>
                    <Box sx={{ height: 32, borderBottom: "1px solid #334155", my: 1, display: "flex", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: "cursive", fontSize: 16, color: "#1e3a8a" }}>Eng. Samuel Mbuguah, Lead FM</span>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Head of Facilities & Engineering</span>
                      <span>{new Date().toLocaleDateString("en-GB")}</span>
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: "dashed" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                      CERTIFIED BY (LANDLORD / MANAGING AGENT)
                    </Typography>
                    <Box sx={{ height: 32, borderBottom: "1px solid #334155", my: 1, display: "flex", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: "cursive", fontSize: 16, color: "#047857" }}>Authorized Signatory</span>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Board of Directors / Client</span>
                      <span>Official Stamp / Seal</span>
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: "divider", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => previewReport && exportReport(previewReport, "csv")}
            startIcon={<Download size={14} />}
          >
            Export CSV
          </Button>

          <Button
            variant="contained"
            onClick={() => previewReport && exportReport(previewReport, "pdf")}
            startIcon={<Download size={14} />}
          >
            Download Verified PDF
          </Button>

          <Button
            variant="text"
            color="inherit"
            onClick={() => window.print()}
            startIcon={<Printer size={14} />}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
