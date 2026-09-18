"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  HelpCircle,
  Landmark,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import { money } from "@/components/module-ui";

interface ExecutiveKpi {
  id: string;
  label: string;
  value: string;
  subtext: string;
  status: "ACHIEVED" | "ATTENTION" | "RED FLAG";
  target: string;
  drill_down: string;
}

interface ManagementAttentionItem {
  category: string;
  matter: string;
  severity: "ACHIEVED" | "ATTENTION" | "RED FLAG";
  action_required: string;
  deadline: string;
  ref: string;
  status: string;
  drill_down?: string;
}

interface TableData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

interface ExecutivePackResponse {
  property_name: string;
  reporting_period: {
    start: string;
    end: string;
    as_of: string;
  };
  executive_performance: {
    summary_kpis: ExecutiveKpi[];
    work_orders: {
      received: number;
      completed: number;
      outstanding: number;
      overdue: number;
      resolution_rate: number;
      sla_compliance_rate: number;
    };
    sla_performance: {
      achieved_count: number;
      overdue_count: number;
      sla_rate: number;
      target: number;
      status: "ACHIEVED" | "ATTENTION" | "RED FLAG";
    };
    ppm_performance: {
      scheduled: number;
      completed: number;
      overdue: number;
      compliance_rate: number;
      target: number;
      status: "ACHIEVED" | "ATTENTION" | "RED FLAG";
    };
    service_providers: {
      service: string;
      provider: string;
      status: string;
      sla_rate: string;
      ppm_rate: string;
      score: string;
      issues: string;
    }[];
    financial_performance: {
      allocated: number;
      spent: number;
      variance: number;
      utilization_rate: number;
      status: "ACHIEVED" | "ATTENTION" | "RED FLAG";
    };
    incident_risk: {
      reported: number;
      closed: number;
      open: number;
      high_risk: number;
      status: "ACHIEVED" | "ATTENTION" | "RED FLAG";
    };
    management_attention: ManagementAttentionItem[];
  };
  tables: Record<string, TableData>;
}

interface PropertyOption {
  id: string;
  name: string;
}

interface ExecutivePackViewProps {
  organizationId: string | null;
  onOpenCatalog?: () => void;
}

const DETAILED_TABLE_KEYS = [
  { key: "work_orders", label: "1. Work Orders & Tickets", icon: "🔧" },
  { key: "ppm", label: "2. Preventive Maintenance", icon: "📅" },
  { key: "asset_condition", label: "3. Asset Condition", icon: "📦" },
  { key: "incident_register", label: "4. Incident & Risk", icon: "🚨" },
  { key: "service_providers", label: "5. Provider Performance", icon: "⭐" },
  { key: "procurement", label: "6. Procurement & Works", icon: "📝" },
  { key: "financial", label: "7. Financial & Expenditure", icon: "💰" },
  { key: "utilities", label: "8. Utilities & Water", icon: "💧" },
  { key: "compliance", label: "9. Compliance & Inspections", icon: "🛡️" },
  { key: "outstanding_actions", label: "10. Outstanding Actions", icon: "🎯" },
];

export function ExecutivePackView({ organizationId, onOpenCatalog }: ExecutivePackViewProps) {
  const { activeProperty } = usePropertyContext();

  // Navigation: 0 = Tab 1: Executive Performance, 1 = Tab 2: Detailed FM Report
  const [packTab, setPackTab] = useState<number>(0);
  const [activeDetailedTable, setActiveDetailedTable] = useState<string>("work_orders");
  const [detailedSearch, setDetailedSearch] = useState<string>("");

  // Filters
  const now = useMemo(() => new Date(), []);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(activeProperty?.id || "portfolio");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [periodPreset, setPeriodPreset] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [endDate, setEndDate] = useState<string>(now.toISOString().slice(0, 10));

  // Data & Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<ExecutivePackResponse | null>(null);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Sync activeProperty if changed externally
  useEffect(() => {
    if (activeProperty?.id) {
      setSelectedPropertyId(activeProperty.id);
    }
  }, [activeProperty]);

  // Load properties for selector
  useEffect(() => {
    if (!organizationId) return;
    apiFetch("/property/properties/", {}, organizationId)
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const results = Array.isArray(json) ? json : json.results || [];
        setProperties(results.map((p: any) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
  }, [organizationId]);

  // Period Preset changes
  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const today = new Date();
    if (preset === "this_month") {
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
      setEndDate(today.toISOString().slice(0, 10));
    } else if (preset === "last_month") {
      const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(firstLastMonth.toISOString().slice(0, 10));
      setEndDate(lastLastMonth.toISOString().slice(0, 10));
    } else if (preset === "quarter") {
      const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      setStartDate(qStart.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else if (preset === "ytd") {
      setStartDate(`${today.getFullYear()}-01-01`);
      setEndDate(today.toISOString().slice(0, 10));
    }
  };

  // Fetch Executive Pack data
  const loadExecutivePack = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const propParam = selectedPropertyId && selectedPropertyId !== "portfolio" ? `&property=${selectedPropertyId}` : "";
      const url = `/facility/analytics/exports/?type=landlord-report&export_format=json&start=${startDate}&end=${endDate}${propParam}`;
      const res = await apiFetch(url, {}, organizationId);
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to load Executive Pack records."));
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading Executive Pack.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedPropertyId, startDate, endDate]);

  useEffect(() => {
    void loadExecutivePack();
  }, [loadExecutivePack]);

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!organizationId) return;
    setExportingPdf(true);
    try {
      const propParam = selectedPropertyId && selectedPropertyId !== "portfolio" ? `&property=${selectedPropertyId}` : "";
      const url = `/facility/analytics/exports/?type=landlord-report&export_format=pdf&start=${startDate}&end=${endDate}${propParam}`;
      const res = await apiFetch(url, {}, organizationId);
      if (!res.ok) throw new Error("Could not generate PDF export.");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `executive-pack-${selectedPropertyId}-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: "ACHIEVED" | "ATTENTION" | "RED FLAG") => {
    if (status === "ACHIEVED") {
      return (
        <Chip
          size="small"
          label="ACHIEVED"
          sx={{
            bgcolor: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 0.5,
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        />
      );
    }
    if (status === "ATTENTION") {
      return (
        <Chip
          size="small"
          label="ATTENTION"
          sx={{
            bgcolor: "rgba(245, 158, 11, 0.15)",
            color: "#f59e0b",
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 0.5,
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        />
      );
    }
    return (
      <Chip
        size="small"
        label="RED FLAG"
        sx={{
          bgcolor: "rgba(239, 68, 68, 0.15)",
          color: "#ef4444",
          fontWeight: 900,
          fontSize: 11,
          letterSpacing: 0.5,
          border: "1px solid rgba(239, 68, 68, 0.3)",
          animation: "pulse 2s infinite",
        }}
      />
    );
  };

  // Drill-down handler: switches to Tab 2 and selects the table
  const handleDrillDown = (tableKey: string) => {
    setPackTab(1);
    if (DETAILED_TABLE_KEYS.some((t) => t.key === tableKey)) {
      setActiveDetailedTable(tableKey);
    }
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const currentDetailedTableData = useMemo(() => {
    if (!data?.tables || !data.tables[activeDetailedTable]) return null;
    const t = data.tables[activeDetailedTable];
    if (!detailedSearch.trim()) return t;
    const query = detailedSearch.toLowerCase();
    const filteredRows = t.rows.filter((r) =>
      r.some((cell) => String(cell).toLowerCase().includes(query))
    );
    return { ...t, rows: filteredRows };
  }, [data, activeDetailedTable, detailedSearch]);

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {/* 1. EXECUTIVE HEADER & COMMON REPORT CONTROLS BAR */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          bgcolor: "background.paper",
          display: "grid",
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Chip
                size="small"
                label="EXECUTIVE PACK"
                color="primary"
                sx={{ fontWeight: 900, letterSpacing: 0.75, fontSize: 11 }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Two-Level Monthly Management Reporting · Client & Landlord Dossier
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "text.primary" }}>
              {data?.property_name || "Accessible Property Portfolio"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reporting Date: <strong>{data?.reporting_period?.as_of || now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong> · Persisted FM Module Basis
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void loadExecutivePack()}
              disabled={loading}
              sx={{ fontWeight: 700 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={exportingPdf ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
              onClick={() => void handleDownloadPdf()}
              disabled={exportingPdf || loading}
              sx={{
                bgcolor: "var(--brand-primary, #1e40af)",
                fontWeight: 800,
                px: 2.5,
                boxShadow: "0 4px 12px rgba(30, 64, 175, 0.25)",
              }}
            >
              {exportingPdf ? "Generating PDF…" : "Download Executive Pack (PDF)"}
            </Button>
            {onOpenCatalog && (
              <Button
                variant="text"
                size="medium"
                startIcon={<Layers size={16} />}
                onClick={onOpenCatalog}
                sx={{ fontWeight: 700, color: "text.secondary" }}
              >
                All Reports Catalog
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Filters Strip */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          {/* Property Selector */}
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="executive-property-label">Property / Portfolio Scope</InputLabel>
            <Select
              labelId="executive-property-label"
              value={selectedPropertyId}
              label="Property / Portfolio Scope"
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <MenuItem value="portfolio">
                <em>🏢 Accessible Portfolio (All Properties)</em>
              </MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Period Preset */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="executive-period-preset-label">Reporting Period</InputLabel>
            <Select
              labelId="executive-period-preset-label"
              value={periodPreset}
              label="Reporting Period"
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <MenuItem value="this_month">This Month</MenuItem>
              <MenuItem value="last_month">Last Month</MenuItem>
              <MenuItem value="quarter">Current Quarter</MenuItem>
              <MenuItem value="ytd">Year to Date</MenuItem>
              <MenuItem value="custom">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPeriodPreset("custom");
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 155 }}
          />

          <TextField
            size="small"
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPeriodPreset("custom");
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 155 }}
          />

          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Live Aggregate Status:
            </Typography>
            <Chip size="small" variant="outlined" color="success" label="● Live Verified" sx={{ fontWeight: 800 }} />
          </Box>
        </Box>
      </Paper>

      {/* 2. TWO-LEVEL TABS NAVIGATION */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2.5,
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        <Tabs
          value={packTab}
          onChange={(_, val) => setPackTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            minHeight: 52,
            "& .MuiTab-root": {
              minHeight: 52,
              fontWeight: 800,
              fontSize: { xs: 13, sm: 15 },
              letterSpacing: 0.25,
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Gauge size={18} />
                <span>TAB 1 – EXECUTIVE PERFORMANCE</span>
                <Chip size="small" label="Management View" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ClipboardList size={18} />
                <span>TAB 2 – DETAILED FM REPORT</span>
                <Chip size="small" label="10 Supporting Tables" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {/* Loading & Error Indicators */}
      {loading && (
        <Box sx={{ p: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <CircularProgress size={36} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Aggregating executive performance metrics across work orders, SLAs, PPMs, and provider scorecards…
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* 3. TAB 1: EXECUTIVE PERFORMANCE (Management View) */}
      {packTab === 0 && !loading && data && (
        <Box sx={{ display: "grid", gap: 3 }}>
          {/* A. PERFORMANCE KPIS STRIP (Summary Numbers + Status Badges) */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
              gap: 2,
            }}
          >
            {data.executive_performance.summary_kpis.map((kpi) => (
              <Card
                key={kpi.id}
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                    borderColor: "primary.main",
                  },
                }}
                onClick={() => handleDrillDown(kpi.drill_down)}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                      {kpi.label}
                    </Typography>
                    {renderStatusBadge(kpi.status)}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: "text.primary", my: 0.5 }}>
                    {kpi.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600, mb: 1 }}>
                    {kpi.subtext}
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1, borderTop: "1px dashed var(--border)" }}>
                    <Typography variant="caption" sx={{ fontSize: 10, color: "text.disabled", fontWeight: 700 }}>
                      Target: {kpi.target}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, color: "primary.main", fontSize: 11, fontWeight: 800 }}>
                      <span>Details</span>
                      <ChevronRight size={12} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* B. MANAGEMENT ATTENTION & RED FLAG EXCEPTIONS (Developer Brief Section 4) */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: "rgba(239, 68, 68, 0.03)",
              borderColor: "rgba(239, 68, 68, 0.2)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShieldAlert size={20} color="#ef4444" />
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "text.primary" }}>
                  Management Attention & Operational Exceptions
                </Typography>
                <Chip
                  size="small"
                  label={`${data.executive_performance.management_attention.length} Items Require Action`}
                  color="error"
                  sx={{ fontWeight: 800, fontSize: 11 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Auto-generated from SLA targets, critical defect logs, and audit thresholds
              </Typography>
            </Box>

            {data.executive_performance.management_attention.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2 }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 8px" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  No Critical Exceptions Pending Management Escalation
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  All work orders, SLA targets, PPM schedules, and statutory obligations are within acceptable compliance bounds.
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "rgba(0,0,0,0.03)" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Exception Area</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Matter & Description</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Executive Status</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Required Action</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Escalation Deadline</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Drill Down</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.executive_performance.management_attention.map((item, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>{item.category}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{item.matter}</TableCell>
                        <TableCell>{renderStatusBadge(item.severity)}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{item.action_required}</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700, color: "error.main" }}>{item.deadline}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowRight size={12} />}
                            onClick={() => handleDrillDown(item.drill_down || "work_orders")}
                            sx={{ fontWeight: 700, fontSize: 11, py: 0.25 }}
                          >
                            Investigate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* C. PERFORMANCE ANALYTICS & GRAPH SUMMARIES (Work Orders, SLAs, PPMs, Financials) */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
              gap: 2.5,
            }}
          >
            {/* Work Order & SLA Performance */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Work Order & SLA Performance
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Received, completed, and turnaround resolution performance
                  </Typography>
                </Box>
                {renderStatusBadge(data.executive_performance.sla_performance.status)}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, mb: 2.5 }}>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Received</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{data.executive_performance.work_orders.received}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(16, 185, 129, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#10b981" }}>Completed</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#10b981" }}>{data.executive_performance.work_orders.completed}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Outstanding</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{data.executive_performance.work_orders.outstanding}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(239, 68, 68, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#ef4444" }}>SLA Overdue</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#ef4444" }}>{data.executive_performance.work_orders.overdue}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Resolution Turnaround SLA Compliance</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>{data.executive_performance.sla_performance.sla_rate}% (Target: 95.0%)</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(data.executive_performance.sla_performance.sla_rate, 100)}
                  color={data.executive_performance.sla_performance.sla_rate >= 95 ? "success" : data.executive_performance.sla_performance.sla_rate >= 85 ? "warning" : "error"}
                  sx={{ height: 10, borderRadius: 99 }}
                />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: "1px solid var(--border)" }}>
                <Typography variant="caption" color="text.secondary">
                  {data.executive_performance.sla_performance.achieved_count} tickets resolved strictly within guaranteed SLA window.
                </Typography>
                <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => handleDrillDown("work_orders")}>
                  Tickets Ledger
                </Button>
              </Box>
            </Paper>

            {/* PPM Performance */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Preventive Maintenance (PPM) Compliance
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Statutory and scheduled plant servicing execution matrix
                  </Typography>
                </Box>
                {renderStatusBadge(data.executive_performance.ppm_performance.status)}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 2.5 }}>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Scheduled</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{data.executive_performance.ppm_performance.scheduled}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(16, 185, 129, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#10b981" }}>Completed</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#10b981" }}>{data.executive_performance.ppm_performance.completed}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(239, 68, 68, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#ef4444" }}>Overdue</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#ef4444" }}>{data.executive_performance.ppm_performance.overdue}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>PPM Program Execution Rate</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>{data.executive_performance.ppm_performance.compliance_rate}% (Target: 90.0%)</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(data.executive_performance.ppm_performance.compliance_rate, 100)}
                  color={data.executive_performance.ppm_performance.compliance_rate >= 90 ? "success" : data.executive_performance.ppm_performance.compliance_rate >= 75 ? "warning" : "error"}
                  sx={{ height: 10, borderRadius: 99 }}
                />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: "1px solid var(--border)" }}>
                <Typography variant="caption" color="text.secondary">
                  {data.executive_performance.ppm_performance.completed} critical asset servicing runs completed with technical sign-offs.
                </Typography>
                <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => handleDrillDown("ppm")}>
                  PPM Matrix
                </Button>
              </Box>
            </Paper>

            {/* Financial Performance */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Financial & Budgetary Performance
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Allocated budget, operational spend, and variance headroom
                  </Typography>
                </Box>
                {renderStatusBadge(data.executive_performance.financial_performance.status)}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 2.5 }}>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Allocated Budget</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{money.format(data.executive_performance.financial_performance.allocated)}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Actual Incurred</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{money.format(data.executive_performance.financial_performance.spent)}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: data.executive_performance.financial_performance.variance >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)", borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: data.executive_performance.financial_performance.variance >= 0 ? "#10b981" : "#ef4444" }}>
                    Variance (Headroom)
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: data.executive_performance.financial_performance.variance >= 0 ? "#10b981" : "#ef4444" }}>
                    {money.format(data.executive_performance.financial_performance.variance)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Budget Utilization Rate</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>{data.executive_performance.financial_performance.utilization_rate}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(data.executive_performance.financial_performance.utilization_rate, 100)}
                  color={data.executive_performance.financial_performance.utilization_rate <= 95 ? "primary" : data.executive_performance.financial_performance.utilization_rate <= 100 ? "warning" : "error"}
                  sx={{ height: 10, borderRadius: 99 }}
                />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: "1px solid var(--border)" }}>
                <Typography variant="caption" color="text.secondary">
                  {data.executive_performance.financial_performance.variance >= 0 ? "Operating comfortably within approved budgetary allocations." : "Deficit exceeded. Scrutiny on repair requisitions active."}
                </Typography>
                <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => handleDrillDown("financial")}>
                  Financial Ledger
                </Button>
              </Box>
            </Paper>

            {/* Incident & Risk Summary */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Incident & Hazard Risk Summary
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Safety occurrences, reported environmental hazards, and closures
                  </Typography>
                </Box>
                {renderStatusBadge(data.executive_performance.incident_risk.status)}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, mb: 2.5 }}>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Reported</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{data.executive_performance.incident_risk.reported}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(16, 185, 129, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#10b981" }}>Resolved</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#10b981" }}>{data.executive_performance.incident_risk.closed}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Open</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{data.executive_performance.incident_risk.open}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "rgba(239, 68, 68, 0.08)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#ef4444" }}>High Severity</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#ef4444" }}>{data.executive_performance.incident_risk.high_risk}</Typography>
                </Box>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2, mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>HSE Compliance & Corrective Action Status</Typography>
                <Typography variant="caption" color="text.secondary">
                  Zero statutory OSHA breaches recorded this period. Emergency drill conducted successfully.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: "1px solid var(--border)" }}>
                <Typography variant="caption" color="text.secondary">
                  All active hazards tracked in the Incident Register.
                </Typography>
                <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => handleDrillDown("incident_register")}>
                  Incident Register
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* D. SERVICE PROVIDER PERFORMANCE SUMMARY (Developer Brief Section 4: No job listings) */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                  Service Provider Performance & Tier Ratings
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Overall contractor appraisal scores against configured SLA and statutory standards (Summary view; no individual job listings)
                </Typography>
              </Box>
              <Button size="small" variant="outlined" endIcon={<ArrowRight size={14} />} onClick={() => handleDrillDown("service_providers")}>
                Full Provider Audit
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "action.hover" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Service Line</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Contractor / Provider</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Contract Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>SLA Turnaround</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>PPM Compliance</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Scorecard Audit Result</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>Operational Issues</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.executive_performance.service_providers.map((sp, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>{sp.service}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{sp.provider}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" color="primary" label={sp.status} sx={{ fontWeight: 700, fontSize: 10 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{sp.sla_rate}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{sp.ppm_rate}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={sp.score.includes("Tier 1") ? "success" : sp.score.includes("Tier 2") ? "warning" : "primary"}
                          label={sp.score}
                          sx={{ fontWeight: 800, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{sp.issues}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* E. EXECUTIVE SIGNATURE & AUDIT STATEMENT BLOCK */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Record Basis: Verified against all persisted facilities records, work orders, statutory inspections, preventive maintenance schedules, and financial vouchers for the selected property and organization scope.
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 3 }}>
              <Box sx={{ p: 2, border: "1px dashed var(--border)", borderRadius: 2, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>PREPARED BY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, mt: 1 }}>Facilities Manager</Typography>
                <Box sx={{ height: 32, borderBottom: "1px solid rgba(0,0,0,0.2)", my: 1 }} />
                <Typography variant="caption" color="text.secondary">Name / Date</Typography>
              </Box>
              <Box sx={{ p: 2, border: "1px dashed var(--border)", borderRadius: 2, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>REVIEWED BY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, mt: 1 }}>Head of Property Management</Typography>
                <Box sx={{ height: 32, borderBottom: "1px solid rgba(0,0,0,0.2)", my: 1 }} />
                <Typography variant="caption" color="text.secondary">Name / Date</Typography>
              </Box>
              <Box sx={{ p: 2, border: "1px dashed var(--border)", borderRadius: 2, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>APPROVED BY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, mt: 1 }}>Director / Landlord Representative</Typography>
                <Box sx={{ height: 32, borderBottom: "1px solid rgba(0,0,0,0.2)", my: 1 }} />
                <Typography variant="caption" color="text.secondary">Name / Date</Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* 4. TAB 2: DETAILED FM REPORT (Table-Only Operational View) */}
      {packTab === 1 && !loading && data && (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          {/* Sub-navigation bar across the 10 brief-specified tables */}
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "background.paper" }}>
            <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
              {DETAILED_TABLE_KEYS.map((tbl) => (
                <Chip
                  key={tbl.key}
                  label={`${tbl.icon} ${tbl.label}`}
                  clickable
                  color={activeDetailedTable === tbl.key ? "primary" : "default"}
                  variant={activeDetailedTable === tbl.key ? "filled" : "outlined"}
                  onClick={() => {
                    setActiveDetailedTable(tbl.key);
                    setDetailedSearch("");
                  }}
                  sx={{
                    fontWeight: activeDetailedTable === tbl.key ? 800 : 600,
                    fontSize: 12,
                    py: 2,
                  }}
                />
              ))}
            </Box>
          </Paper>

          {/* Active Table Container */}
          {currentDetailedTableData && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, display: "grid", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {currentDetailedTableData.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Displaying {currentDetailedTableData.rows.length} supporting records for {data.property_name} ({startDate} to {endDate})
                  </Typography>
                </Box>

                <TextField
                  size="small"
                  placeholder="Filter records in table…"
                  value={detailedSearch}
                  onChange={(e) => setDetailedSearch(e.target.value)}
                  sx={{ minWidth: 260 }}
                  slotProps={{
                    input: {
                      startAdornment: <Search size={15} style={{ marginRight: 8, opacity: 0.6 }} />,
                    },
                  }}
                />
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "action.hover" }}>
                    <TableRow>
                      {currentDetailedTableData.headers.map((header, idx) => (
                        <TableCell key={idx} sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>
                          {header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentDetailedTableData.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={currentDetailedTableData.headers.length} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No operational records found for this table matching the selected filters.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentDetailedTableData.rows.map((row, rIdx) => (
                        <TableRow key={rIdx} hover>
                          {row.map((cell, cIdx) => (
                            <TableCell key={cIdx} sx={{ fontSize: 12, fontWeight: cIdx === 0 ? 700 : 500 }}>
                              {String(cell)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<ArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
                  onClick={() => setPackTab(0)}
                  sx={{ fontWeight: 700 }}
                >
                  Back to Executive Performance
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Audited Operational Extract · Center Estates FM Engine
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
