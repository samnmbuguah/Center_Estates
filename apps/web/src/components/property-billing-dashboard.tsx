"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/module-ui";
import { BillingRun, BillingIssue, Candidate } from "./billing/types";
import { BillingHeader, BillingMode } from "./billing/BillingHeader";
import { BillingActionBanner } from "./billing/BillingActionBanner";
import { BillingKpis } from "./billing/BillingKpis";
import { CandidateTable } from "./billing/CandidateTable";
import { CandidatePreviewDrawer } from "./billing/CandidatePreviewDrawer";
import { OverrideDialog } from "./billing/OverrideDialog";

type Invoice = { id: string; number: string; tenant_name: string; unit_code: string; amount: string; status: string; issued_on: string };

export type BillingContext = {
  mode: string;
  period_start: string;
  period_end: string;
  months_count: number;
  label: string;
};

export function PropertyBillingDashboard({ onNavigate, onSingleInvoice }: { onNavigate: (tab: string) => void; onSingleInvoice: (ctx: BillingContext) => void }) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  
  const [mode, setMode] = useState<BillingMode>("monthly");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [quarterYear, setQuarterYear] = useState(now.getFullYear());
  const [quarterIndex, setQuarterIndex] = useState(Math.floor(now.getMonth() / 3) + 1); // 1, 2, 3, 4
  const [customStart, setCustomStart] = useState(`${now.getFullYear()}-01`);
  const [customEnd, setCustomEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [overrideIssue, setOverrideIssue] = useState<BillingIssue | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  const canFinance = can("property.finance");
  const canApprove = can("property.approve");

  // Calculate period_start and period_end based on active billing mode
  const { period_start, period_end, formattedPeriod } = useMemo(() => {
    if (mode === "monthly") {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;
      const label = new Date(y, m - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
      return { period_start: start, period_end: end, formattedPeriod: label };
    }
    if (mode === "quarterly") {
      const startMonth = (quarterIndex - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const start = `${quarterYear}-${String(startMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(quarterYear, endMonth, 0)).getUTCDate();
      const end = `${quarterYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const qNames = ["Jan – Mar", "Apr – Jun", "Jul – Sep", "Oct – Dec"];
      const label = `Q${quarterIndex} ${quarterYear} (${qNames[quarterIndex - 1]})`;
      return { period_start: start, period_end: end, formattedPeriod: label };
    }
    // Custom / Multi-month
    const [sy, sm] = customStart.split("-").map(Number);
    const [ey, em] = customEnd.split("-").map(Number);
    const start = `${customStart}-01`;
    const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
    const end = `${customEnd}-${String(lastDay).padStart(2, "0")}`;
    const monthsCount = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    const sLabel = new Date(sy, sm - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
    const eLabel = new Date(ey, em - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
    const label = `${sLabel} – ${eLabel} (${monthsCount} Months)`;
    return { period_start: start, period_end: end, formattedPeriod: label };
  }, [mode, month, quarterYear, quarterIndex, customStart, customEnd]);

  const changeMonth = (offset: number) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const changeQuarter = (offset: number) => {
    let nextQ = quarterIndex + offset;
    let nextY = quarterYear;
    if (nextQ > 4) { nextQ = 1; nextY += 1; }
    if (nextQ < 1) { nextQ = 4; nextY -= 1; }
    setQuarterIndex(nextQ);
    setQuarterYear(nextY);
  };

  const handlePrev = () => {
    if (mode === "monthly") changeMonth(-1);
    else if (mode === "quarterly") changeQuarter(-1);
  };

  const handleNext = () => {
    if (mode === "monthly") changeMonth(1);
    else if (mode === "quarterly") changeQuarter(1);
  };

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const [runRes, invRes] = await Promise.all([apiFetch("/property/billing-runs/", {}, organizationId), apiFetch("/property/invoices/", {}, organizationId)]);
    if (!runRes.ok || !invRes.ok) { setError(await apiErrorMessage(!runRes.ok ? runRes : invRes, "Billing data could not be loaded.")); setLoading(false); return; }
    const runRows = (await runRes.json()) as BillingRun[];
    const invRows = (await invRes.json()) as Invoice[];
    setInvoices(invRows);

    const matching = runRows.find(r => r.period_start === period_start && r.period_end === period_end)
      || runRows.find(r => r.period_start === period_start);
    setRun(matching ?? null);
    setSelected(matching?.candidates.filter(c => c.status === "ready").map(c => c.id) ?? []);
    setLoading(false);
  }, [period_start, period_end, organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");
    const body = action === "create"
      ? { period_start, period_end }
      : action === "generate" ? { candidate_ids: selected } : {};
    const res = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify(body) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(body) }, organizationId);
    if (!res.ok) { setError(await apiErrorMessage(res, `Billing ${action} failed.`)); }
    else { setNotice({ create: `Queue for ${formattedPeriod} created.`, prepare: "Readiness check complete.", approve: "Run approved — ready to generate.", generate: `${selected.length} invoices generated.` }[action] ?? "Done."); }
    await load(); setBusy("");
  }

  async function authorizeOverride() {
    if (!organizationId || !run || !overrideIssue) return;
    setBusy("override"); setError(""); setNotice("");
    const res = await apiFetch(`/property/billing-runs/${run.id}/resolve-issue/`, { method: "POST", body: JSON.stringify({ issue: overrideIssue.id, status: "overridden", notes: overrideNotes }) }, organizationId);
    if (!res.ok) { setError(await apiErrorMessage(res, "Override failed.")); }
    else { setOverrideIssue(null); setOverrideNotes(""); setNotice("Exception overridden."); }
    await load(); setBusy("");
  }

  const totals = run?.totals ?? {};
  const ready = Number(totals.ready ?? run?.candidates.filter(c => c.status === "ready").length ?? 0);
  const issues = Number(totals.with_issues ?? run?.candidates.filter(c => c.status === "issue").length ?? 0);
  const blockingOpen = Boolean(run?.issues.some(i => i.severity === "blocking" && i.status === "open"));
  const generatedThisPeriod = invoices.filter(i => i.issued_on >= period_start && i.issued_on <= period_end);

  const visibleCandidates = useMemo(() => {
    const rows = run?.candidates ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.tenant_name, c.lease_reference, c.unit_code, c.property_name].join(" ").toLowerCase().includes(q);
    });
  }, [run, search, statusFilter]);

  const readyVisibleIds = visibleCandidates.filter(c => c.status === "ready").map(c => c.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every(id => selected.includes(id));

  if (loading) return <LoadingState rows={6} />;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
      {error && <Alert severity="error" action={<button className="btn ghost sm" onClick={() => void load()}>Retry</button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <BillingHeader
        formattedPeriod={formattedPeriod}
        runStatus={run?.status ?? null}
        mode={mode}
        onModeChange={setMode}
        onPrev={handlePrev}
        onNext={handleNext}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <BillingActionBanner
        hasRun={Boolean(run)}
        isReview={run?.status === "review"}
        isApproved={run?.status === "approved"}
        formattedMonth={formattedPeriod}
        ready={ready}
        issues={issues}
        selectedCount={selected.length}
        blockingOpen={blockingOpen}
        busy={busy}
        canFinance={canFinance}
        canApprove={canApprove}
        onInitialize={() => void mutate("create")}
        onRecheck={() => void mutate("prepare")}
        onApprove={() => void mutate("approve")}
        onGenerate={() => void mutate("generate")}
        onSingleInvoice={() => onSingleInvoice({ mode, period_start, period_end, months_count: (() => {
          const [sy, sm] = period_start.split("-").map(Number);
          const [ey, em] = period_end.split("-").map(Number);
          return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
        })(), label: formattedPeriod })}
      />

      <BillingKpis
        totals={totals}
        ready={ready}
        issues={issues}
        generatedCount={generatedThisPeriod.length}
        generatedAmount={generatedThisPeriod.reduce((a, i) => a + Number(i.amount), 0)}
      />

      <CandidateTable
        candidates={visibleCandidates}
        run={Boolean(run)}
        search={search}
        statusFilter={statusFilter}
        selected={selected}
        allReadySelected={allReadySelected}
        readyCount={readyVisibleIds.length}
        busy={busy}
        formattedMonth={formattedPeriod}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onSelectAll={() => setSelected(allReadySelected ? selected.filter(id => !readyVisibleIds.includes(id)) : Array.from(new Set([...selected, ...readyVisibleIds])))}
        onSelect={(id) => setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
        onPreview={setPreviewCandidate}
        onOverride={(c) => setOverrideIssue(c.issue_summary?.[0] ? { id: c.id, code: c.issue_summary[0].code, message: c.issue_summary[0].message, severity: c.issue_summary[0].severity, status: "open" } : null)}
        onSingleInvoice={() => onSingleInvoice({ mode, period_start, period_end, months_count: (() => {
          const [sy, sm] = period_start.split("-").map(Number);
          const [ey, em] = period_end.split("-").map(Number);
          return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
        })(), label: formattedPeriod })}
        onNavigate={onNavigate}
      />

      <OverrideDialog
        issue={overrideIssue}
        notes={overrideNotes}
        busy={busy}
        onNotesChange={setOverrideNotes}
        onAuthorize={() => void authorizeOverride()}
        onClose={() => { setOverrideIssue(null); setOverrideNotes(""); }}
      />

      {previewCandidate && <CandidatePreviewDrawer candidate={previewCandidate} onClose={() => setPreviewCandidate(null)} />}
    </Box>
  );
}
