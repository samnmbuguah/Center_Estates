"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { LoadingState, money } from "@/components/module-ui";
import { BillingRun, BillingIssue, Candidate, Invoice, InvoiceChargeType, candidateHasChargeType, invoiceChargeType, isMissingWaterReading } from "./billing/types";
import { BillingHeader, BillingMode } from "./billing/BillingHeader";
import { BillingActionBanner } from "./billing/BillingActionBanner";
import { BillingChargeRollup } from "./billing/BillingChargeRollup";
import { BillingKpis } from "./billing/BillingKpis";
import { CandidateTable } from "./billing/CandidateTable";
import { CandidatePreviewDrawer } from "./billing/CandidatePreviewDrawer";
import { OverrideDialog } from "./billing/OverrideDialog";
import { QuickRecordMeterModal } from "./billing/QuickRecordMeterModal";

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
  
  const [billingTarget, setBillingTarget] = useState<"tenant" | "landlord">("tenant");
  const [mode, setMode] = useState<BillingMode>("monthly");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [quarterYear, setQuarterYear] = useState(now.getFullYear());
  const [quarterIndex, setQuarterIndex] = useState(Math.floor(now.getMonth() / 3) + 1); // 1, 2, 3, 4
  const [customStart, setCustomStart] = useState(`${now.getFullYear()}-01`);
  const [customEnd, setCustomEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const [allRuns, setAllRuns] = useState<BillingRun[]>([]);
  const [run, setRun] = useState<BillingRun | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chargeTypeFilter, setChargeTypeFilter] = useState<InvoiceChargeType | "all">("all");
  const [search, setSearch] = useState("");
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [recordMeterCandidate, setRecordMeterCandidate] = useState<Candidate | null>(null);
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
    try {
      const [runRes, invRes, propRes] = await Promise.all([
        apiFetch("/property/billing-runs/", {}, organizationId),
        apiFetch("/property/invoices/", {}, organizationId),
        apiFetch("/property/properties/", {}, organizationId),
      ]);
      if (!runRes.ok || !invRes.ok) {
        setError(await apiErrorMessage(!runRes.ok ? runRes : invRes, "Billing data could not be loaded."));
        setLoading(false);
        return;
      }
      const runRows = (await runRes.json()) as BillingRun[];
      const invRows = (await invRes.json()) as Invoice[];
      setAllRuns(runRows);
      setInvoices(invRows);
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(Array.isArray(propData) ? propData : propData.results ?? []);
      }
    } catch {
      setError("Failed to communicate with billing service.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(true); }, [load]);

  // Deep-link: /property?tab=billing&billing_type=service_charge pre-selects the filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bt = params.get("billing_type") || params.get("invoice_type") || params.get("charge_type");
    if (bt) {
      const norm = bt.toLowerCase().replace("-", "_");
      if (norm === "servicecharge") setChargeTypeFilter("service_charge");
      else if (["rent", "service_charge", "utility", "other"].includes(norm)) setChargeTypeFilter(norm as InvoiceChargeType);
      else if (norm === "landlord") setBillingTarget("landlord");
    }
  }, []);

  // Synchronously match run from allRuns when period or allRuns change — instant transition with zero flicker
  useEffect(() => {
    const matching = allRuns.find(r => r.period_start === period_start && r.period_end === period_end)
      || allRuns.find(r => r.period_start === period_start);
    setRun(matching ?? null);
  }, [allRuns, period_start, period_end]);

  // Auto-scan and auto-prepare queue whenever period or filters change
  const lastScannedKey = useRef<string>("");
  useEffect(() => {
    if (!organizationId || loading || busy || billingTarget !== "tenant") return;
    const scanKey = `${period_start}_${period_end}_${chargeTypeFilter}`;
    if (lastScannedKey.current === scanKey) return;

    const matching = allRuns.find(r => r.period_start === period_start && r.period_end === period_end)
      || allRuns.find(r => r.period_start === period_start);

    if (!matching) {
      lastScannedKey.current = scanKey;
      void mutate("create");
    } else if (matching.status === "preparing" && (!matching.candidates || matching.candidates.length === 0)) {
      lastScannedKey.current = scanKey;
      void mutate("prepare");
    }
  }, [organizationId, loading, busy, billingTarget, period_start, period_end, chargeTypeFilter, allRuns]);

  // Compute Landlord Candidates dynamically based on managed properties and contracted revenue
  const landlordCandidates = useMemo<Candidate[]>(() => {
    if (properties.length === 0) return [];
    const startMonthStr = period_start.slice(0, 7);
    return properties.map((p) => {
      // Management fees are legally and contractually based on actual collections (receipted rent),
      // not on uncollected hypothetical rent rolls.
      const propertyInvoices = invoices.filter(
        (inv) =>
          (inv.property_id === p.id ||
            inv.property_name?.toLowerCase() === p.name?.toLowerCase()) &&
          inv.issued_on >= period_start &&
          inv.issued_on <= period_end
      );
      const rentCollected = propertyInvoices
        .filter(
          (inv) =>
            inv.invoice_type?.toLowerCase().includes("rent") ||
            inv.charge_type === "rent"
        )
        .reduce((sum, inv) => {
          const paid = Number(
            inv.amount_paid ?? (Number(inv.amount || 0) - Number(inv.balance || 0))
          );
          return sum + (paid > 0 ? paid : 0);
        }, 0);

      const mgmtRate = Number(p.management_fee_rate || 5.0); // Standard 5.0%
      const commissionAmount = Math.round(rentCollected * (mgmtRate / 100));

      const existingInv = invoices.find(
        (inv) =>
          (inv.tenant_name?.toLowerCase().includes((p.owner_name || p.name).toLowerCase()) ||
           inv.number?.startsWith("LB-") ||
           inv.tenant_name?.toLowerCase().includes("landlord")) &&
          inv.issued_on >= period_start && inv.issued_on <= period_end
      );
      const isBilled = Boolean(existingInv);
      const hasCollections = commissionAmount > 0;

      return {
        id: `landlord-${p.id}`,
        tenant_name: p.owner_name || p.landlord_name || `${p.name} Property Owner`,
        property_name: p.name,
        unit_code: `${p.units_count || p.total_units || 'Whole'} Units`,
        lease_reference: `MGMT-COMMISSION-${startMonthStr}`,
        due_date: period_end,
        billing_items: [
          {
            code: "mgmt_fee",
            description: hasCollections
              ? `Management Commission (${mgmtRate.toFixed(2)}% of ${money.format(rentCollected)} collected rent)`
              : `Management Commission (${mgmtRate.toFixed(2)}% — KES 0 collected)`,
            amount: String(commissionAmount),
            total: String(commissionAmount),
            billed: isBilled,
            invoice_number: existingInv?.number,
          },
        ],
        total: String(commissionAmount),
        status: isBilled ? "generated" : (hasCollections ? "ready" : "excluded"),
        issue_summary: hasCollections
          ? []
          : [
              {
                code: "NO_COLLECTIONS",
                message: "Awaiting rent collections. Management fee is charged only upon receipted funds.",
                severity: "warning",
              },
            ],
      };
    });
  }, [properties, invoices, period_start, period_end]);

  const prepareTypesBody = chargeTypeFilter !== "all"
    ? { invoice_types: chargeTypeFilter === "utility" ? ["water", "electricity", "utility"] : [chargeTypeFilter] }
    : {};

  async function mutate(action: "create" | "prepare" | "approve" | "generate") {
    if (!organizationId) return;
    setBusy(action); setError(""); setNotice("");

    // Landlord Billing Generation
    if (billingTarget === "landlord" && action === "generate") {
      try {
        const selectedCandidates = landlordCandidates.filter((c) => selected.includes(c.id) && c.status === "ready");
        for (const cand of selectedCandidates) {
          await apiFetch(
            "/property/invoices/",
            {
              method: "POST",
              body: JSON.stringify({
                recipient_name: cand.tenant_name,
                property_name: cand.property_name,
                invoice_type: "Management Fee",
                amount: cand.total,
                due_date: cand.due_date,
                notes: `Property Management Commission for ${formattedPeriod}`,
              }),
            },
            organizationId
          );
        }
        setNotice(`Generated ${selectedCandidates.length} Landlord Management Invoice(s) for ${formattedPeriod}.`);
      } catch {
        setError("Failed to generate landlord invoices.");
      }
      await load();
      setBusy("");
      return;
    }

    // Tenant Billing Run Mutate
    const body: Record<string, unknown> = action === "create"
      ? { period_start, period_end }
      : action === "generate"
        ? {
            candidate_ids: selected,
            ...prepareTypesBody,
          }
        : action === "prepare"
          ? prepareTypesBody
          : {};
    let res = action === "create"
      ? await apiFetch("/property/billing-runs/", { method: "POST", body: JSON.stringify(body) }, organizationId)
      : await apiFetch(`/property/billing-runs/${run?.id}/${action}/`, { method: "POST", body: JSON.stringify(body) }, organizationId);

    if (action === "create" && res.ok) {
      const createdRun = (await res.json()) as BillingRun;
      res = await apiFetch(
        `/property/billing-runs/${createdRun.id}/prepare/`,
        { method: "POST", body: JSON.stringify(prepareTypesBody) },
        organizationId,
      );
    }

    if (!res.ok) {
      if (res.status === 404 && action === "prepare") {
        setRun(null);
        setBusy("");
        await mutate("create");
        return;
      }
      setError(await apiErrorMessage(res, `Billing ${action} failed.`));
    }
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

  const isCandidateReady = (c: Candidate, filter: InvoiceChargeType | "all"): boolean => {
    if (c.status === "issue" || c.status === "excluded") return false;
    if (billingTarget === "landlord") {
      return (c.billing_items || []).some((it: any) => !it.billed);
    }
    if (filter === "all") {
      return (c.billing_items || []).some((it: any) => !it.billed);
    }
    return (c.billing_items || []).some((it: any) => {
      const t = invoiceChargeType(it.code);
      const matchesType = filter === "utility" ? t === "utility" : t === filter;
      return matchesType && !it.billed;
    });
  };

  const rawCandidates = billingTarget === "landlord" ? landlordCandidates : (run?.candidates ?? []);

  const totals = useMemo(() => {
    if (billingTarget === "landlord") {
      const totalAmt = landlordCandidates.reduce((s, c) => s + Number(c.total || 0), 0);
      const readyAmt = landlordCandidates.filter(c => c.status === "ready").reduce((s, c) => s + Number(c.total || 0), 0);
      return {
        total_candidates: landlordCandidates.length,
        ready_count: landlordCandidates.filter(c => c.status === "ready").length,
        total_amount: totalAmt,
        ready_amount: readyAmt,
        with_issues: 0,
      };
    }
    return run?.totals ?? {};
  }, [billingTarget, landlordCandidates, run]);

  const issues = Number(totals.with_issues ?? run?.candidates.filter(c => c.status === "issue").length ?? 0);
  const blockingOpen = Boolean(run?.issues?.some(i => i.severity === "blocking" && i.status === "open"));
  const generatedThisPeriod = invoices.filter(i => i.issued_on >= period_start && i.issued_on <= period_end);

  const filteredReadyForBanner = useMemo(() => {
    return rawCandidates.filter((c) => isCandidateReady(c, chargeTypeFilter)).length;
  }, [rawCandidates, chargeTypeFilter, billingTarget]);

  const typeCounts = useMemo(() => {
    const rows = rawCandidates;
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
  }, [rawCandidates]);

  const visibleCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawCandidates.filter(c => {
      if (billingTarget === "tenant") {
        if (chargeTypeFilter !== "all" && !candidateHasChargeType(c, chargeTypeFilter)) return false;
      }
      if (statusFilter === "ready" && !isCandidateReady(c, chargeTypeFilter)) return false;
      if (statusFilter === "generated" && isCandidateReady(c, chargeTypeFilter)) return false;
      if (statusFilter !== "all" && statusFilter !== "ready" && statusFilter !== "generated" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.tenant_name, c.lease_reference, c.unit_code, c.property_name].join(" ").toLowerCase().includes(q);
    });
  }, [rawCandidates, search, statusFilter, chargeTypeFilter, billingTarget]);

  const readyVisibleIds = visibleCandidates.filter(c => isCandidateReady(c, chargeTypeFilter)).map(c => c.id);
  const allReadySelected = readyVisibleIds.length > 0 && readyVisibleIds.every(id => selected.includes(id));

  useEffect(() => {
    const readyIds = rawCandidates.filter((c) => isCandidateReady(c, chargeTypeFilter)).map((c) => c.id);
    setSelected(readyIds);
  }, [run?.id, chargeTypeFilter, billingTarget, rawCandidates.length]);

  if (loading && allRuns.length === 0) return <LoadingState rows={6} />;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
      {error && <Alert severity="error" action={<button className="btn ghost sm" onClick={() => void load()}>Retry</button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <BillingHeader
        formattedPeriod={formattedPeriod}
        runStatus={billingTarget === "landlord" ? (filteredReadyForBanner > 0 ? "ready" : "generated") : (run?.status ?? null)}
        billingTarget={billingTarget}
        onBillingTargetChange={(target) => {
          setBillingTarget(target);
          setSearch("");
          setStatusFilter("all");
        }}
        mode={mode}
        onModeChange={setMode}
        onPrev={handlePrev}
        onNext={handleNext}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <BillingKpis
        totals={totals}
        ready={filteredReadyForBanner}
        issues={issues}
        generatedCount={generatedThisPeriod.length}
        generatedAmount={generatedThisPeriod.reduce((a, i) => a + Number(i.amount), 0)}
      />

      <BillingChargeRollup
        candidates={rawCandidates}
        activeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
        onSelectFilter={(t) => {
          setChargeTypeFilter(t);
          const matching = rawCandidates.filter((c) => isCandidateReady(c, t)).map((c) => c.id);
          setSelected(matching);
        }}
      />

      <BillingActionBanner
        hasRun={billingTarget === "landlord" ? true : Boolean(run)}
        isPreparing={billingTarget === "landlord" ? false : run?.status === "preparing"}
        isReview={billingTarget === "landlord" ? true : run?.status === "review"}
        isApproved={billingTarget === "landlord" ? true : run?.status === "approved"}
        formattedMonth={formattedPeriod}
        ready={filteredReadyForBanner}
        issues={issues}
        selectedCount={selected.length}
        chargeTypeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
        typeCounts={typeCounts}
        pendingWaterCount={rawCandidates.filter((c) => isMissingWaterReading(c)).length}
        onLogMeters={() => onNavigate("meters")}
        onChargeTypeFilter={(t: InvoiceChargeType | "all") => {
          setChargeTypeFilter(t);
          const matching = rawCandidates.filter((c) => isCandidateReady(c, t)).map((c) => c.id);
          setSelected(matching);
        }}
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

      <CandidateTable
        candidates={visibleCandidates}
        run={billingTarget === "landlord" ? true : Boolean(run)}
        search={search}
        statusFilter={statusFilter}
        chargeTypeFilter={chargeTypeFilter}
        billingTarget={billingTarget}
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
          if (t !== "all") {
            setSelected((prev) => prev.filter((id) => {
              const c = rawCandidates.find((x) => x.id === id);
              return c ? candidateHasChargeType(c, t) : true;
            }));
          }
        }}
        onSelectAll={() => setSelected(allReadySelected ? selected.filter(id => !readyVisibleIds.includes(id)) : Array.from(new Set([...selected, ...readyVisibleIds])))}
        onSelect={(id) => setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
        onPreview={setPreviewCandidate}
        onOverride={(c) => setOverrideIssue(c.issue_summary?.[0] ? { id: c.id, code: c.issue_summary[0].code, message: c.issue_summary[0].message, severity: c.issue_summary[0].severity, status: "open" } : null)}
        onRecordMeter={setRecordMeterCandidate}
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

      {previewCandidate && (
        <CandidatePreviewDrawer
          candidate={previewCandidate}
          onClose={() => setPreviewCandidate(null)}
          onRecordMeter={(c) => {
            setPreviewCandidate(null);
            setRecordMeterCandidate(c);
          }}
        />
      )}

      <QuickRecordMeterModal
        candidate={recordMeterCandidate}
        periodEnd={run?.period_end ?? period_end}
        open={Boolean(recordMeterCandidate)}
        onClose={() => setRecordMeterCandidate(null)}
        onSuccess={async () => {
          setNotice("Water meter reading recorded and approved! Refreshing billing queue…");
          await mutate("prepare");
          await load();
        }}
      />
    </Box>
  );
}
