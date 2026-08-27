"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/module-ui";
import { BillingRun, BillingIssue, Candidate, InvoiceChargeType, candidateHasChargeType } from "./billing/types";
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

  const [allRuns, setAllRuns] = useState<BillingRun[]>([]);
  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chargeTypeFilter, setChargeTypeFilter] = useState<InvoiceChargeType | "all">("all");
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

  const load = useCallback(async (showSkeleton = false) => {
    if (!organizationId) return;
    if (showSkeleton) setLoading(true);
    setError("");
    const [runRes, invRes] = await Promise.all([apiFetch("/property/billing-runs/", {}, organizationId), apiFetch("/property/invoices/", {}, organizationId)]);
    if (!runRes.ok || !invRes.ok) { setError(await apiErrorMessage(!runRes.ok ? runRes : invRes, "Billing data could not be loaded.")); setLoading(false); return; }
    const runRows = (await runRes.json()) as BillingRun[];
    const invRows = (await invRes.json()) as Invoice[];
    setAllRuns(runRows);
    setInvoices(invRows);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(true); }, [load]);

  // Synchronously match run from allRuns when period or allRuns change — instant transition with zero flicker
  useEffect(() => {
    const matching = allRuns.find(r => r.period_start === period_start && r.period_end === period_end)
      || allRuns.find(r => r.period_start === period_start);
    setRun(matching ?? null);
    setSelected(matching?.candidates.filter(c => c.status === "ready").map(c => c.id) ?? []);
  }, [allRuns, period_start, period_end]);

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");
    const body: Record<string, unknown> = action === "create"
      ? { period_start, period_end }
      : action === "generate"
        ? {
            candidate_ids: selected,
            ...(chargeTypeFilter !== "all" ? { invoice_types: chargeTypeFilter === "utility" ? ["water", "electricity", "utility"] : [chargeTypeFilter] } : {}),
          }
        : {};
    let res = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify(body) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(body) }, organizationId);

    // Starting a billing run means both creating its durable queue and scanning
    // the active leases. Previously only the empty queue was created, leaving
    // the run permanently in "preparing" with no candidates and no visible
    // way to continue.
    if (action === "create" && res.ok) {
      const createdRun = (await res.json()) as BillingRun;
      res = await apiFetch(
        `/property/billing-runs/${createdRun.id}/prepare/`,
        { method: "POST", body: JSON.stringify({}) },
        organizationId,
      );
    }

    if (!res.ok) { setError(await apiErrorMessage(res, `Billing ${action} failed.`)); }
    else if (action === "generate") {
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const g = Number(json.generated_count ?? 0);
      const s = Number(json.skipped_duplicate ?? 0);
      setNotice(s > 0 ? `${g} invoice(s) generated, ${s} already billed for this period — skipped (no duplicates created).` : `${g} invoice(s) generated for ${formattedPeriod}.`);
    } else { setNotice({ create: `Readiness scan for ${formattedPeriod} is complete.`, prepare: "Readiness check complete.", approve: "Run confirmed — ready to generate." }[action] ?? "Done."); }
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
  const filteredReadyForBanner = useMemo(() => {
    if (chargeTypeFilter === "all" || !run) return ready;
    return (run.candidates ?? []).filter((c) => candidateHasChargeType(c, chargeTypeFilter) && c.status === "ready").length;
  }, [run, chargeTypeFilter, ready]);

  const typeCounts = useMemo(() => {
    const rows = run?.candidates ?? [];
    const counts: Record<string, number> = { rent: 0, service_charge: 0, utility: 0, other: 0 };
    for (const c of rows) {
      for (const t of new Set(c.billing_items.map((it) => {
        const code = String(it.code || "").trim().toLowerCase();
        if (code === "rent") return "rent";
        if (code === "sc" || code === "service_charge") return "service_charge";
        if (code === "water" || code === "electricity" || code === "utility") return "utility";
        return "other";
      }))) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [run]);

  const visibleCandidates = useMemo(() => {
    const rows = run?.candidates ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(c => {
      if (chargeTypeFilter !== "all" && !candidateHasChargeType(c, chargeTypeFilter)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.tenant_name, c.lease_reference, c.unit_code, c.property_name].join(" ").toLowerCase().includes(q);
    });
  }, [run, search, statusFilter, chargeTypeFilter]);

  const readyVisibleIds = visibleCandidates.filter(c => c.status === "ready").map(c => c.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every(id => selected.includes(id));

  if (loading && allRuns.length === 0) return <LoadingState rows={6} />;

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
        isPreparing={run?.status === "preparing"}
        isReview={run?.status === "review"}
        isApproved={run?.status === "approved"}
        formattedMonth={formattedPeriod}
        ready={chargeTypeFilter === "all" ? ready : filteredReadyForBanner}
        issues={issues}
        selectedCount={selected.length}
        chargeTypeFilter={chargeTypeFilter}
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
        chargeTypeFilter={chargeTypeFilter}
        typeCounts={typeCounts}
        selected={selected}
        allReadySelected={allReadySelected}
        readyCount={readyVisibleIds.length}
        busy={busy}
        formattedMonth={formattedPeriod}
        runPeriodStart={run?.period_start ?? period_start}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onChargeTypeFilter={(t) => {
          setChargeTypeFilter(t);
          // Prune selection to candidates that still match the new filter
          if (t !== "all") {
            setSelected((prev) => prev.filter((id) => {
              const c = run?.candidates.find((x) => x.id === id);
              return c ? candidateHasChargeType(c, t) : true;
            }));
          }
        }}
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
