"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  Filter,
  Layers,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  WalletCards,
  Waves,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { DetailDrawer, EmptyState, LoadingState, money, StatusPill } from "@/components/module-ui";

type Candidate = {
  id: string;
  tenant_name: string;
  property_name: string;
  unit_code: string;
  lease_reference: string;
  due_date: string;
  billing_items: Array<{ code: string; description: string; total?: string; amount?: string }>;
  total: string;
  status: string;
  issue_summary: Array<{ code: string; message: string; severity: string }>;
  invoice_number?: string;
  meter_readings?: Array<{ meter_type: string; previous: number; current: number; units: number }>;
};

type BillingIssue = {
  id: string;
  code: string;
  message: string;
  severity: string;
  status: string;
  resolution_notes?: string;
};

type BillingRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  totals: Record<string, string | number>;
  candidates: Candidate[];
  issues: BillingIssue[];
};

type Invoice = {
  id: string;
  number: string;
  tenant_name: string;
  unit_code: string;
  amount: string;
  status: string;
  issued_on: string;
};

const statusToneMap: Record<string, "green" | "red" | "yellow" | "blue" | "gray"> = {
  ready: "green",
  generated: "green",
  issued: "green",
  approved: "blue",
  paid: "green",
  issue: "red",
  overdue: "red",
  blocking: "red",
  review: "yellow",
  preparing: "yellow",
  warning: "yellow",
  excluded: "gray",
};

function issueResolution(code: string): { label: string; href: string } | null {
  if (code.includes("water") || code.includes("meter")) return { label: "Inspect Water Meters", href: "/facility?tab=meters" };
  if (code.includes("lease") || code.includes("rent")) return { label: "Review Lease Terms", href: "/property?tab=leases" };
  if (code.includes("duplicate") || code.includes("invoice")) return { label: "Check Invoice Register", href: "/property?tab=rent" };
  return null;
}

export function PropertyBillingDashboard({
  onNavigate,
  onSingleInvoice,
}: {
  onNavigate: (tab: string) => void;
  onSingleInvoice: () => void;
}) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [overrideIssue, setOverrideIssue] = useState<BillingIssue | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  const canFinance = can("property.finance");
  const canApprove = can("property.approve");

  // Month navigation helper
  const changeMonth = (offset: number) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const [runResponse, invoiceResponse] = await Promise.all([
      apiFetch("/property/billing-runs/", {}, organizationId),
      apiFetch("/property/invoices/", {}, organizationId),
    ]);
    if (!runResponse.ok || !invoiceResponse.ok) {
      if (runResponse.status === 403 || invoiceResponse.status === 403) {
        setError("Billing and invoice generation requires Finance or Platform Administrator access for this organization.");
      } else {
        setError(await apiErrorMessage(!runResponse.ok ? runResponse : invoiceResponse, "Billing information could not be loaded."));
      }
      setLoading(false);
      return;
    }
    const runRows = (await runResponse.json()) as BillingRun[];
    const invoiceRows = (await invoiceResponse.json()) as Invoice[];
    setInvoices(invoiceRows);
    const matching = runRows.find((item) => item.period_start.startsWith(month));
    setRun(matching ?? null);
    setSelected(matching?.candidates.filter((item) => item.status === "ready").map((item) => item.id) ?? []);
    setLoading(false);
  }, [month, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action);
    setError("");
    setNotice("");
    const [year, monthNumber] = month.split("-").map(Number);
    const periodStart = `${month}-01`;
    const periodEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const response =
      action === "create"
        ? await apiFetch(
            "/property/billing-runs/",
            { method: "POST", body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }) },
            organizationId
          )
        : await apiFetch(
            `/property/billing-runs/${run?.id}/${action}/`,
            { method: "POST", body: JSON.stringify(action === "generate" ? { candidate_ids: selected } : {}) },
            organizationId
          );
    if (!response.ok) {
      setError(await apiErrorMessage(response, `The billing ${action} action could not be completed.`));
    } else {
      const labelsMap: Record<string, string> = {
        create: `Monthly billing queue for ${month} created successfully.`,
        prepare: "Readiness validation completed. Candidate invoices refreshed.",
        approve: "Billing run approved. Invoices are unlocked and ready for generation.",
        generate: `Successfully generated ${selected.length} invoice(s) for this run.`,
      };
      setNotice(labelsMap[action] ?? "Billing action completed.");
    }
    await load();
    setBusy("");
  }

  async function authorizeOverride() {
    if (!organizationId || !run || !overrideIssue) return;
    setBusy("override");
    setError("");
    setNotice("");
    const response = await apiFetch(
      `/property/billing-runs/${run.id}/resolve-issue/`,
      {
        method: "POST",
        body: JSON.stringify({ issue: overrideIssue.id, status: "overridden", notes: overrideNotes }),
      },
      organizationId
    );
    if (!response.ok) {
      setError(await apiErrorMessage(response, "The billing exception could not be authorized."));
    } else {
      setOverrideIssue(null);
      setOverrideNotes("");
      setNotice("Exception authorized by approver. Candidate status has been updated to Ready.");
    }
    await load();
    setBusy("");
  }

  const totals = run?.totals ?? {};
  const ready = Number(totals.ready ?? run?.candidates.filter((item) => item.status === "ready").length ?? 0);
  const issues = Number(totals.with_issues ?? run?.candidates.filter((item) => item.status === "issue").length ?? 0);
  const blockingOpen = Boolean(run?.issues.some((issue) => issue.severity === "blocking" && issue.status === "open"));
  const generatedThisMonth = invoices.filter((item) => item.issued_on?.startsWith(month));
  const paidThisMonth = generatedThisMonth.filter((item) => item.status === "paid");
  const overdue = invoices.filter((item) => item.status === "overdue");
  const waterIssues = run?.issues.filter((item) => item.code.includes("water") || item.code.includes("meter")) ?? [];

  // Stepper calculations
  const currentStep = !run ? 0 : run.status === "preparing" ? 1 : run.status === "review" ? 2 : run.status === "approved" ? 3 : 4;

  const visibleCandidates = useMemo(() => {
    const rows = run?.candidates ?? [];
    const query = search.trim().toLowerCase();
    return rows.filter((candidate) => {
      if (statusFilter !== "all" && candidate.status !== statusFilter) return false;
      if (!query) return true;
      return [candidate.tenant_name, candidate.lease_reference, candidate.unit_code, candidate.property_name]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [run, search, statusFilter]);

  const readyVisibleIds = visibleCandidates.filter((item) => item.status === "ready").map((item) => item.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every((id) => selected.includes(id));

  // Formatted month name e.g. "August 2026"
  const formattedMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
  }, [month]);

  if (loading) return <LoadingState rows={6} />;

  return (
    <Box sx={{ display: "grid", gap: 2.5, width: "100%" }}>
      {/* 1. HEADER & PERIOD CONTROLLER */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          flexDirection: { xs: "column", md: "row" },
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <span style={{ fontSize: 18 }}>🧾</span>
            <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: "0.1em", color: "#38bdf8" }}>
              COLLECTIONS & INVOICE AUTOMATION
            </Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em" }}>
            Rent & Billing Control Hub
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 0.25 }}>
            Automate monthly lease calculations, utility meter aggregation, multi-level approvals, and M-Pesa STK payment issuance.
          </Typography>
        </Box>

        {/* Period Selector & Quick Actions */}
        <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              p: 0.5,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Button
              size="small"
              onClick={() => changeMonth(-1)}
              sx={{ minWidth: 32, p: 0.5, color: "#ffffff" }}
              aria-label="Previous Month"
            >
              <ChevronLeft size={18} />
            </Button>
            <Typography sx={{ px: 1.5, fontWeight: 700, fontSize: 13, color: "#ffffff", whiteSpace: "nowrap" }}>
              {formattedMonth}
            </Typography>
            <Button
              size="small"
              onClick={() => changeMonth(1)}
              sx={{ minWidth: 32, p: 0.5, color: "#ffffff" }}
              aria-label="Next Month"
            >
              <ChevronRight size={18} />
            </Button>
          </Box>

          <TextField
            type="month"
            size="small"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            slotProps={{
              input: {
                sx: {
                  color: "#ffffff",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                },
              },
            }}
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {/* 2. INTERACTIVE 4-STEP BILLING PIPELINE STEPPER */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, background: "var(--surface)" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
            Monthly Billing Pipeline Workflow
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {run && (
              <Chip
                size="small"
                label={`Status: ${run.status.replace(/_/g, " ").toUpperCase()}`}
                color={run.status === "approved" || run.status === "generated" ? "success" : run.status === "review" ? "warning" : "default"}
                sx={{ fontWeight: 800, fontSize: 11 }}
              />
            )}
            <Button size="small" variant="text" onClick={() => void load()} startIcon={<RotateCcw size={14} />}>
              Refresh State
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
          {[
            {
              step: 1,
              title: "1. Stage Queue",
              desc: run ? `${run.candidates.length} candidate units mapped` : "Initialize lease & utility queue",
              status: currentStep > 0 ? "done" : currentStep === 0 ? "active" : "pending",
              icon: <Layers size={18} />,
            },
            {
              step: 2,
              title: "2. Validate Readiness",
              desc: waterIssues.length > 0 ? `${waterIssues.length} meter issues require review` : `${ready} units ready to bill`,
              status: currentStep > 1 ? "done" : currentStep === 1 ? "active" : "pending",
              icon: <FileCheck2 size={18} />,
            },
            {
              step: 3,
              title: "3. Run Approvals",
              desc: run?.status === "approved" ? "Approved by Finance" : blockingOpen ? "Blocked by open issues" : "Awaiting sign-off",
              status: currentStep > 2 ? "done" : currentStep === 2 ? "active" : "pending",
              icon: <ShieldAlert size={18} />,
            },
            {
              step: 4,
              title: "4. Batch Dispatch",
              desc: generatedThisMonth.length > 0 ? `${generatedThisMonth.length} invoices generated & sent` : "Generate PDF, Email & SMS",
              status: currentStep >= 4 ? "done" : currentStep === 3 ? "active" : "pending",
              icon: <Send size={18} />,
            },
          ].map((item) => {
            const isDone = item.status === "done";
            const isActive = item.status === "active";
            return (
              <Box
                key={item.step}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: "1.5px solid",
                  borderColor: isActive ? "#3b82f6" : isDone ? "#22c55e" : "var(--border)",
                  background: isActive ? "rgba(59, 130, 246, 0.05)" : isDone ? "rgba(34, 197, 94, 0.04)" : "transparent",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  transition: "all 0.2s ease",
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: isDone ? "#22c55e" : isActive ? "#3b82f6" : "var(--border)",
                    color: "#ffffff",
                    flexShrink: 0,
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {isDone ? <CheckCircle2 size={18} /> : item.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: isActive ? "#1d4ed8" : "var(--text)" }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mt: 0.25, lineHeight: 1.3 }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* 3. DYNAMIC HERO ACTION BANNER */}
      {!run ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(226, 59, 59, 0.08) 0%, rgba(249, 115, 22, 0.08) 100%)",
            border: "1.5px solid rgba(226, 59, 59, 0.2)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2.5,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box sx={{ maxWidth: 650 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <span style={{ fontSize: 22 }}>🚀</span>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "var(--text)" }}>
                Initialize {formattedMonth} Billing Run
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
              No billing queue has been prepared for <strong>{formattedMonth}</strong> yet. Initializing the queue will automatically scan all active leases, apply base rent & service charges, and calculate utility consumption from approved water/electricity meters.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, flexShrink: 0 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Sparkles size={18} />}
              disabled={!canFinance || Boolean(busy)}
              onClick={() => void mutate("create")}
              sx={{
                bgcolor: "#e23b3b",
                "&:hover": { bgcolor: "#cc2b2b" },
                fontWeight: 800,
                px: 3,
                py: 1.25,
                borderRadius: 2,
              }}
            >
              {busy === "create" ? "Initializing Queue…" : `Generate ${formattedMonth} Queue`}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<FilePlus2 size={18} />}
              onClick={onSingleInvoice}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Single Invoice
            </Button>
          </Stack>
        </Paper>
      ) : run.status === "review" ? (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)",
            border: "1.5px solid rgba(234, 179, 8, 0.3)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#854d0e" }}>
              Queue Prepared — {ready} Ready, {issues} Exceptions
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              Review the candidate invoices below. Run readiness checks to verify meter data, or authorize approval to unlock invoice generation.
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RotateCcw size={16} />}
              disabled={Boolean(busy)}
              onClick={() => void mutate("prepare")}
            >
              {busy === "prepare" ? "Re-checking…" : "Re-run Readiness Check"}
            </Button>
            {canApprove && (
              <Button
                variant="contained"
                color="warning"
                disabled={blockingOpen || Boolean(busy)}
                onClick={() => void mutate("approve")}
                sx={{ fontWeight: 800 }}
              >
                Approve Billing Run
              </Button>
            )}
          </Stack>
        </Paper>
      ) : run.status === "approved" ? (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
            border: "1.5px solid rgba(34, 197, 94, 0.3)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#15803d" }}>
              ✅ Billing Run Approved — Ready for Batch Generation
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              <strong>{selected.length}</strong> invoice candidate(s) selected for generation. Invoices will be stamped, sent to tenant portals, and queued for SMS/Email dispatch.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<Send size={18} />}
            disabled={!canFinance || selected.length === 0 || Boolean(busy)}
            onClick={() => void mutate("generate")}
            sx={{ fontWeight: 800, px: 3, borderRadius: 2 }}
          >
            {busy === "generate" ? "Generating Invoices…" : `Generate ${selected.length} Invoices Now`}
          </Button>
        </Paper>
      ) : null}

      {/* 4. EXECUTIVE METRIC KPI STRIP */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
          gap: 1.5,
        }}
      >
        {[
          {
            label: "Target Revenue",
            value: money.format(Number(totals.total_amount ?? 0)),
            sub: `${totals.candidates ?? 0} Total Units`,
            tone: "#3b82f6",
            icon: "🎯",
          },
          {
            label: "Ready to Bill",
            value: money.format(Number(totals.amount_ready ?? 0)),
            sub: `${ready} Invoices Verified`,
            tone: "#22c55e",
            icon: "✨",
          },
          {
            label: "Exceptions / Blocked",
            value: money.format(Number(totals.amount_with_issues ?? 0)),
            sub: `${issues} Units Need Action`,
            tone: issues > 0 ? "#ef4444" : "#94a3b8",
            icon: "⚠️",
          },
          {
            label: "Generated This Month",
            value: money.format(generatedThisMonth.reduce((acc, i) => acc + Number(i.amount), 0)),
            sub: `${generatedThisMonth.length} Invoices Issued`,
            tone: "#6366f1",
            icon: "📄",
          },
          {
            label: "Collected (Paid)",
            value: money.format(paidThisMonth.reduce((acc, i) => acc + Number(i.amount), 0)),
            sub: `${paidThisMonth.length} Invoices Settled`,
            tone: "#10b981",
            icon: "💰",
          },
          {
            label: "Overdue Arrears",
            value: money.format(overdue.reduce((acc, i) => acc + Number(i.amount), 0)),
            sub: `${overdue.length} Past Due`,
            tone: overdue.length > 0 ? "#f97316" : "#94a3b8",
            icon: "⏳",
          },
        ].map((kpi, idx) => (
          <Paper
            key={idx}
            variant="outlined"
            sx={{
              p: 1.75,
              borderRadius: 2.5,
              background: "var(--surface)",
              borderTop: "3px solid",
              borderTopColor: kpi.tone,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 10 }}>
                {kpi.label}
              </Typography>
              <span style={{ fontSize: 16 }}>{kpi.icon}</span>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "var(--text)", lineHeight: 1.2 }}>
              {kpi.value}
            </Typography>
            <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, fontWeight: 600 }}>
              {kpi.sub}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* 5. MAIN CONTENT AREA: CANDIDATE TABLE + SIDEBAR PANELS */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 2fr) minmax(320px, 0.85fr)" }, gap: 2.5 }}>
        {/* CANDIDATE INVOICE REGISTER TABLE */}
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", background: "var(--surface)" }}>
          {/* Table Toolbar */}
          <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Candidate Invoices Queue — {formattedMonth}
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                Itemized lease amounts and utility readings queued for invoice issuance.
              </Typography>
            </Box>

            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" startIcon={<FilePlus2 size={15} />} onClick={onSingleInvoice}>
                Single Invoice
              </Button>
              <Button size="small" variant="outlined" onClick={() => onNavigate("rent")}>
                Invoice Register
              </Button>
              <Button size="small" variant="outlined" onClick={() => onNavigate("receipts")}>
                Receipts
              </Button>
            </Stack>
          </Box>

          {/* Search & Filter Bar */}
          {run && (
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, background: "var(--bg-app)" }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: "center", flex: 1, minWidth: 240 }}>
                <TextField
                  size="small"
                  placeholder="Search by tenant, unit code, lease…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <Search size={16} style={{ marginRight: 8, color: "var(--text-secondary)" }} />,
                      sx: { borderRadius: 2, background: "var(--surface)", fontSize: 13 },
                    },
                  }}
                  sx={{ flex: 1, maxWidth: 360 }}
                />
                <TextField
                  select
                  size="small"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{ minWidth: 140 }}
                  slotProps={{ input: { sx: { borderRadius: 2, background: "var(--surface)", fontSize: 13 } } }}
                >
                  <MenuItem value="all">All Candidates</MenuItem>
                  <MenuItem value="ready">✨ Ready Only</MenuItem>
                  <MenuItem value="issue">⚠️ With Issues</MenuItem>
                  <MenuItem value="generated">📄 Generated</MenuItem>
                  <MenuItem value="excluded">Excluded</MenuItem>
                </TextField>
              </Stack>

              {readyVisibleIds.length > 0 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={allReadySelected}
                      onChange={() =>
                        setSelected(
                          allReadySelected
                            ? selected.filter((id) => !readyVisibleIds.includes(id))
                            : Array.from(new Set([...selected, ...readyVisibleIds]))
                        )
                      }
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12 }}>
                      Select All Ready ({readyVisibleIds.length})
                    </Typography>
                  }
                />
              )}
            </Box>
          )}

          {busy && <LinearProgress />}

          {!run ? (
            <EmptyState
              title="No Billing Run Active"
              description={`Click "Generate ${formattedMonth} Queue" to begin aggregating rent, service charges, and water readings for this month.`}
            />
          ) : visibleCandidates.length === 0 ? (
            <EmptyState
              title="No Matching Candidates"
              description="Try clearing your search query or adjusting your status filters."
            />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", width: 40 }}></th>
                    <th style={{ padding: "10px 14px" }}>Tenant & Lease</th>
                    <th style={{ padding: "10px 14px" }}>Unit / Location</th>
                    <th style={{ padding: "10px 14px" }}>Billing Breakdown</th>
                    <th style={{ padding: "10px 14px" }}>Total Due</th>
                    <th style={{ padding: "10px 14px" }}>Readiness</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((candidate) => {
                    const isSelected = selected.includes(candidate.id);
                    const isReady = candidate.status === "ready";
                    const hasIssues = candidate.issue_summary && candidate.issue_summary.length > 0;
                    return (
                      <tr
                        key={candidate.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: isSelected ? "rgba(59, 130, 246, 0.04)" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px 14px" }}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${candidate.tenant_name}`}
                            disabled={!isReady && candidate.status !== "approved"}
                            checked={isSelected}
                            onChange={() =>
                              setSelected((curr) =>
                                curr.includes(candidate.id)
                                  ? curr.filter((id) => id !== candidate.id)
                                  : [...curr, candidate.id]
                              )
                            }
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "var(--surface-sunken)",
                                border: "1px solid var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 12,
                                color: "var(--primary)",
                              }}
                            >
                              {candidate.tenant_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text)" }}>{candidate.tenant_name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                {candidate.lease_reference} {candidate.invoice_number ? `· ${candidate.invoice_number}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600 }}>{candidate.property_name}</div>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--surface-sunken)",
                              border: "1px solid var(--border)",
                              fontWeight: 700,
                            }}
                          >
                            Unit {candidate.unit_code}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {candidate.billing_items.map((item, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: item.code.toLowerCase().includes("water")
                                    ? "rgba(14, 165, 233, 0.1)"
                                    : "var(--surface-sunken)",
                                  color: item.code.toLowerCase().includes("water") ? "#0284c7" : "var(--text)",
                                  border: "1px solid var(--border)",
                                  fontWeight: 600,
                                }}
                              >
                                {item.code.toUpperCase()}
                              </span>
                            ))}
                          </div>
                          {hasIssues && (
                            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
                              ⚠️ {candidate.issue_summary.map((i) => i.message).join("; ")}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                            {money.format(Number(candidate.total))}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Due: {candidate.due_date}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <StatusPill tone={statusToneMap[candidate.status] || "gray"}>
                            {candidate.status.replace(/_/g, " ")}
                          </StatusPill>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Eye size={13} />}
                            onClick={() => setSelectedCandidate(candidate)}
                            sx={{ fontSize: 11, py: 0.25, px: 1, borderRadius: 1.5 }}
                          >
                            Preview
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </Paper>

        {/* SIDEBAR WIDGETS: METER READINGS & RECENT INVOICES */}
        <Stack sx={{ gap: 2.5 }}>
          {/* UTILITY METER READINESS WIDGET */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, background: "var(--surface)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Waves size={18} style={{ color: "#0284c7" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Water & Utility Meter Health
                </Typography>
              </Box>
              <Chip
                size="small"
                label={waterIssues.length === 0 ? "100% Ready" : `${waterIssues.length} Missing`}
                color={waterIssues.length === 0 ? "success" : "error"}
                sx={{ fontWeight: 800, fontSize: 10 }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.4 }}>
              {waterIssues.length === 0
                ? "All sub-meters have approved readings captured for this billing cycle."
                : `${waterIssues.length} unit(s) are missing verified meter readings before water invoices can be finalized.`}
            </Typography>
            <Stack direction="row" sx={{ gap: 1, mt: 2 }}>
              <Button
                component={Link}
                href="/facility?tab=meters"
                variant="outlined"
                size="small"
                sx={{ flex: 1, fontSize: 12 }}
              >
                Inspect Meter Register
              </Button>
              <Button
                component={Link}
                href="/facility?tab=meters"
                variant="contained"
                size="small"
                sx={{ bgcolor: "#0284c7", "&:hover": { bgcolor: "#0369a1" }, fontSize: 12 }}
              >
                + Quick Read
              </Button>
            </Stack>
          </Paper>

          {/* READINESS EXCEPTIONS LIST */}
          {run?.issues && run.issues.some((issue) => issue.status === "open") && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, background: "var(--surface)", borderLeft: "4px solid #ef4444" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#ef4444" }}>
                  Open Validation Issues ({run.issues.filter((i) => i.status === "open").length})
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mb: 1.5 }}>
                Resolve underlying records or grant an approved override exception.
              </Typography>
              <Stack sx={{ gap: 1.25 }}>
                {run.issues
                  .filter((issue) => issue.status === "open")
                  .map((issue) => {
                    const action = issueResolution(issue.code);
                    return (
                      <Box
                        key={issue.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          background: "var(--surface-sunken)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12 }}>
                            {issue.message}
                          </Typography>
                          <Chip
                            size="small"
                            label={issue.severity.toUpperCase()}
                            color={issue.severity === "blocking" ? "error" : "warning"}
                            sx={{ fontSize: 9, height: 18, fontWeight: 800 }}
                          />
                        </Box>
                        <Stack direction="row" sx={{ gap: 1, mt: 1, justifyContent: "flex-end" }}>
                          {action && (
                            <Button size="small" component={Link} href={action.href} sx={{ fontSize: 11, py: 0.25 }}>
                              {action.label} ↗
                            </Button>
                          )}
                          {canApprove && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => {
                                setOverrideIssue(issue);
                                setOverrideNotes("");
                              }}
                              sx={{ fontSize: 11, py: 0.25 }}
                            >
                              Authorize Override
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
              </Stack>
            </Paper>
          )}

          {/* RECENT INVOICES & DISPATCH LOG */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, background: "var(--surface)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <WalletCards size={18} style={{ color: "#10b981" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Recent Invoices Issued
                </Typography>
              </Box>
              <Button size="small" onClick={() => onNavigate("rent")} sx={{ fontSize: 11 }}>
                View All ↗
              </Button>
            </Box>
            {invoices.length === 0 ? (
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                No invoices recorded yet.
              </Typography>
            ) : (
              <Stack sx={{ gap: 1 }}>
                {invoices.slice(0, 5).map((inv) => (
                  <Box
                    key={inv.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      background: "var(--surface-sunken)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{inv.number}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {inv.tenant_name} · Unit {inv.unit_code}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>{money.format(Number(inv.amount))}</div>
                      <StatusPill tone={statusToneMap[inv.status] || "gray"}>{inv.status}</StatusPill>
                    </div>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>

      {/* 6. LIVE INVOICE CANDIDATE PREVIEW DRAWER */}
      {selectedCandidate && (
        <DetailDrawer
          title={`Draft Invoice Preview: ${selectedCandidate.tenant_name}`}
          onClose={() => setSelectedCandidate(null)}
        >
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Header info */}
            <Box sx={{ p: 2, borderRadius: 2, background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: "var(--primary)" }}>
                CANDIDATE DRAFT INVOICE
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {selectedCandidate.tenant_name}
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                {selectedCandidate.property_name} — Unit {selectedCandidate.unit_code}
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mt: 0.5 }}>
                Lease: {selectedCandidate.lease_reference} · Due: {selectedCandidate.due_date}
              </Typography>
            </Box>

            {/* Line items breakdown */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Itemized Charges
              </Typography>
              <Stack sx={{ gap: 1 }}>
                {selectedCandidate.billing_items.map((item, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.description || item.code}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Code: {item.code.toUpperCase()}</div>
                    </div>
                    <div style={{ fontWeight: 800 }}>{money.format(Number(item.total ?? item.amount ?? 0))}</div>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Total */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)",
                border: "1.5px solid rgba(59, 130, 246, 0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Total Payable Amount
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#1d4ed8" }}>
                {money.format(Number(selectedCandidate.total))}
              </Typography>
            </Box>

            {/* Issues if any */}
            {selectedCandidate.issue_summary && selectedCandidate.issue_summary.length > 0 && (
              <Alert severity="warning">
                <strong>Readiness Exceptions:</strong>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {selectedCandidate.issue_summary.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Button variant="contained" onClick={() => setSelectedCandidate(null)}>
              Close Preview
            </Button>
          </Box>
        </DetailDrawer>
      )}

      {/* 7. AUTHORIZE OVERRIDE DIALOG */}
      <Dialog open={Boolean(overrideIssue)} onClose={() => setOverrideIssue(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Authorize Billing Exception</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Authorizing this exception logs an audit approval to allow this candidate invoice to proceed without blocking the entire run.
          </Alert>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{overrideIssue?.message}</Typography>
          <TextField
            autoFocus
            required
            fullWidth
            multiline
            minRows={3}
            label="Approval Rationale & Audit Notes"
            value={overrideNotes}
            onChange={(e) => setOverrideNotes(e.target.value)}
            helperText="Provide reason (e.g., manual meter log verified, lease renewal approved offline)."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOverrideIssue(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!overrideNotes.trim() || Boolean(busy)}
            onClick={() => void authorizeOverride()}
          >
            Authorize Exception
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
