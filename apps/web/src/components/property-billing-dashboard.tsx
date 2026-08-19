"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { LoadingState } from "@/components/module-ui";
import { BillingRun, BillingIssue, Candidate } from "./billing/types";
import { BillingHeader } from "./billing/BillingHeader";
import { BillingActionBanner } from "./billing/BillingActionBanner";
import { BillingKpis } from "./billing/BillingKpis";
import { CandidateTable } from "./billing/CandidateTable";
import { CandidatePreviewDrawer } from "./billing/CandidatePreviewDrawer";
import { OverrideDialog } from "./billing/OverrideDialog";

type Invoice = { id: string; number: string; tenant_name: string; unit_code: string; amount: string; status: string; issued_on: string };

export function PropertyBillingDashboard({ onNavigate, onSingleInvoice }: { onNavigate: (tab: string) => void; onSingleInvoice: () => void }) {
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
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [overrideIssue, setOverrideIssue] = useState<BillingIssue | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  const canFinance = can("property.finance");
  const canApprove = can("property.approve");

  const changeMonth = (offset: number) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const [runRes, invRes] = await Promise.all([apiFetch("/property/billing-runs/", {}, organizationId), apiFetch("/property/invoices/", {}, organizationId)]);
    if (!runRes.ok || !invRes.ok) { setError(await apiErrorMessage(!runRes.ok ? runRes : invRes, "Billing data could not be loaded.")); setLoading(false); return; }
    const runRows = (await runRes.json()) as BillingRun[];
    const invRows = (await invRes.json()) as Invoice[];
    setInvoices(invRows);
    const matching = runRows.find(r => r.period_start.startsWith(month));
    setRun(matching ?? null);
    setSelected(matching?.candidates.filter(c => c.status === "ready").map(c => c.id) ?? []);
    setLoading(false);
  }, [month, organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");
    const [y, m] = month.split("-").map(Number);
    const body = action === "create"
      ? { period_start: `${month}-01`, period_end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
      : action === "generate" ? { candidate_ids: selected } : {};
    const res = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify(body) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(body) }, organizationId);
    if (!res.ok) { setError(await apiErrorMessage(res, `Billing ${action} failed.`)); }
    else { setNotice({ create: `Queue for ${month} created.`, prepare: "Readiness check complete.", approve: "Run approved — ready to generate.", generate: `${selected.length} invoices generated.` }[action] ?? "Done."); }
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
  const generatedThisMonth = invoices.filter(i => i.issued_on?.startsWith(month));

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
  const formattedMonth = useMemo(() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" }); }, [month]);

  if (loading) return <LoadingState rows={6} />;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
      {error && <Alert severity="error" action={<button className="btn ghost sm" onClick={() => void load()}>Retry</button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <BillingHeader formattedMonth={formattedMonth} runStatus={run?.status ?? null} onPrevMonth={() => changeMonth(-1)} onNextMonth={() => changeMonth(1)} />

      <BillingActionBanner
        hasRun={Boolean(run)} isReview={run?.status === "review"} isApproved={run?.status === "approved"}
        formattedMonth={formattedMonth} ready={ready} issues={issues} selectedCount={selected.length}
        blockingOpen={blockingOpen} busy={busy} canFinance={canFinance} canApprove={canApprove}
        onInitialize={() => void mutate("create")} onRecheck={() => void mutate("prepare")}
        onApprove={() => void mutate("approve")} onGenerate={() => void mutate("generate")} onSingleInvoice={onSingleInvoice}
      />

      <BillingKpis totals={totals} ready={ready} issues={issues} generatedCount={generatedThisMonth.length} generatedAmount={generatedThisMonth.reduce((a, i) => a + Number(i.amount), 0)} />

      <CandidateTable
        candidates={visibleCandidates} run={Boolean(run)} search={search} statusFilter={statusFilter}
        selected={selected} allReadySelected={allReadySelected} readyCount={readyVisibleIds.length} busy={busy}
        formattedMonth={formattedMonth} onSearch={setSearch} onStatusFilter={setStatusFilter}
        onSelectAll={() => setSelected(allReadySelected ? selected.filter(id => !readyVisibleIds.includes(id)) : Array.from(new Set([...selected, ...readyVisibleIds])))}
        onSelect={(id) => setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
        onPreview={setPreviewCandidate}
        onOverride={(c) => setOverrideIssue(c.issue_summary?.[0] ? { id: c.id, code: c.issue_summary[0].code, message: c.issue_summary[0].message, severity: c.issue_summary[0].severity, status: "open" } : null)}
        onSingleInvoice={onSingleInvoice} onNavigate={onNavigate}
      />

      <OverrideDialog issue={overrideIssue} notes={overrideNotes} busy={busy} onNotesChange={setOverrideNotes} onAuthorize={() => void authorizeOverride()} onClose={() => { setOverrideIssue(null); setOverrideNotes(""); }} />

      {previewCandidate && <CandidatePreviewDrawer candidate={previewCandidate} onClose={() => setPreviewCandidate(null)} />}
    </Box>
  );
}
