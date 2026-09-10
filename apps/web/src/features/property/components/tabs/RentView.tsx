"use client";

import { useState, useMemo } from "react";
import { Box } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, InvoiceRow, AgingTenantRow, AgingAnalytics,
} from "../../types/property.types";
import { kM, kN, fmtDate, pct, exportCsv, daysUntil } from "../../utils/property.utils";

export function RentView({
  rows = [],
  rentInvoices = [],
  invoices,
  analytics = null,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  onRecordReceipt = () => {},
  onComposeInvoice = () => {},
  onSendReminder = () => {},
  onInvoiceAction = () => {},
  onSelectRow = () => {},
  // Kept as a compatibility input while manual invoicing remains available
  // from the Billing Pipeline. The register deliberately has no duplicate CTA.
  onAddInvoice: _onAddInvoice = () => {},
  onDownloadPdf = () => {},
  onRefresh = () => {},
  canFinance = true,
  canApprove = true,
}: {
  rows?: Row[];
  rentInvoices?: InvoiceRow[];
  invoices?: InvoiceRow[];
  analytics?: AgingAnalytics | null;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onComposeInvoice?: () => void;
  onSendReminder?: (row: InvoiceRow) => void;
  onInvoiceAction?: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void;
  onSelectRow?: (r: Row) => void;
  canFinance?: boolean;
  onAddInvoice?: () => void;
  canApprove?: boolean;
  onDownloadPdf?: (row: InvoiceRow) => void;
  onRefresh?: () => void;
}) {
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<"month" | "all">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recipientFilter, setRecipientFilter] = useState<"all" | "tenant" | "owner">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentInvoices = (invoices && invoices.length > 0 ? invoices : (rows && rows.length > 0 ? rows : rentInvoices)) as InvoiceRow[];
  const displayInvoices = (rows && rows.length > 0 ? rows : currentInvoices) as InvoiceRow[];


  const changeMonth = (offset: number) => {
    const [year, monthNum] = selectedMonth.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    setPeriodMode("month");
  };

  const formattedSelectedMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  const normalizeType = (t?: string): string => {
    const s = String(t || "").trim().toLowerCase();
    if (s === "rent") return "rent";
    if (s === "sc" || s === "service_charge" || s.includes("service")) return "service_charge";
    if (s === "water" || s === "electricity" || s === "utility" || s.includes("utility")) return "utility";
    if (s.includes("mgmt") || s.includes("management") || s.includes("commission") || s.includes("landlord")) return "management_fee";
    return "other";
  };

  const typeLabelMap: Record<string, string> = {
    rent: "Rent",
    service_charge: "Service Charge",
    utility: "Utilities",
    management_fee: "Management Fee",
    other: "Other",
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayInvoices.filter((inv) => {
      // Month / Period filter
      if (periodMode === "month") {
        const invDate = String(inv.issued_on || inv.due_on || "");
        if (!invDate.startsWith(selectedMonth)) {
          // Check metadata billing period as fallback
          const bp = String((inv.metadata as Record<string, unknown> | undefined)?.billing_period || "");
          if (!bp.includes(selectedMonth)) return false;
        }
      }

      // Type filter
      if (typeFilter !== "all") {
        const norm = normalizeType(inv.invoice_type);
        if (norm !== typeFilter) return false;
      }

      // Recipient type filter (Tenant vs Owner — sectional title)
      if (recipientFilter !== "all") {
        const rt = String((inv as any).recipient_type || "tenant").toLowerCase();
        if (rt !== recipientFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all" && String(inv.status).toLowerCase() !== statusFilter) return false;

      // Text search
      if (!q) return true;
      const propName = String((inv.metadata as Record<string, unknown> | undefined)?.property_name ?? "");
      const matchString = [inv.number, inv.tenant_name, propName, inv.invoice_type, inv.amount].join(" ").toLowerCase();
      return matchString.includes(q);
    });
  }, [displayInvoices, periodMode, selectedMonth, typeFilter, statusFilter, recipientFilter, search]);

  // Dynamic distribution counts within current period context
  const counts = useMemo(() => {
    const base = displayInvoices.filter((inv) => {
      if (periodMode === "month") {
        const invDate = String(inv.issued_on || inv.due_on || "");
        if (!invDate.startsWith(selectedMonth)) {
          const bp = String((inv.metadata as Record<string, unknown> | undefined)?.billing_period || "");
          if (!bp.includes(selectedMonth)) return false;
        }
      }
      return true;
    });

    const charge: Record<string, number> = { all: base.length, rent: 0, service_charge: 0, utility: 0, management_fee: 0 };
    const recipient: Record<string, number> = { all: base.length, tenant: 0, owner: 0 };
    const status: Record<string, number> = { all: base.length, draft: 0, issued: 0, partial: 0, paid: 0, overdue: 0, void: 0 };

    for (const inv of base) {
      const norm = normalizeType(inv.invoice_type);
      charge[norm] = (charge[norm] || 0) + 1;

      const rt = String((inv as any).recipient_type || "tenant").toLowerCase();
      recipient[rt] = (recipient[rt] || 0) + 1;

      const st = String(inv.status || "").toLowerCase();
      status[st] = (status[st] || 0) + 1;
    }

    return { charge, recipient, status };
  }, [displayInvoices, periodMode, selectedMonth]);



  const totalBilled = filteredInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const outstanding = filteredInvoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const collectionRate = pct(collected, totalBilled);
  const dueThisMonth = filteredInvoices.filter((i) => {
    const d = new Date(String(i.due_on ?? ""));
    return !Number.isNaN(d.getTime()) && Number(i.balance ?? 0) > 0;
  }).length;

  const selectedInvoices = useMemo(() => {
    return filteredInvoices.filter((i) => selectedIds.has(String(i.id)));
  }, [filteredInvoices, selectedIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  }, [selectedInvoices]);

  const draftSelected = selectedInvoices.filter((i) => i.status === "draft");
  const reviewSelected = selectedInvoices.filter((i) => i.status === "review");
  const approvedSelected = selectedInvoices.filter((i) => i.status === "approved");

  function toggleSelectAll() {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => String(i.id))));
    }
  }

  function toggleSelectOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleBatchAction(action: "submit-review" | "approve" | "issue") {
    const targets = action === "submit-review" ? draftSelected : action === "approve" ? reviewSelected : approvedSelected;
    for (const inv of targets) {
      onInvoiceAction(inv, action);
    }
    setSelectedIds(new Set());
  }

  const aging = analytics?.summary ?? {};
  const agingTotal = Object.values(aging).reduce((s, v) => s + Number(v ?? 0), 0);
  const agingBuckets = [
    { label: "Current (0-30)", key: "current" },
    { label: "31-60 days", key: "31_60" },
    { label: "61-90 days", key: "61_90" },
    { label: "91-120 days", key: "91_120" },
    { label: "120+ days", key: "over_120" },
  ];

  const getTypeBadge = (rawType?: string) => {
    const norm = normalizeType(rawType);
    switch (norm) {
      case "rent":
        return <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(59, 130, 246, 0.12)", color: "var(--color-info)", fontWeight: 700, fontSize: 11 }}>Rent</span>;
      case "service_charge":
        return <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(139, 92, 246, 0.12)", color: "var(--color-violet)", fontWeight: 700, fontSize: 11 }}>Service Charge</span>;
      case "utility":
        return <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(20, 184, 166, 0.12)", color: "var(--color-teal)", fontWeight: 700, fontSize: 11 }}>Utility</span>;
      case "management_fee":
        return <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(245, 158, 11, 0.12)", color: "var(--color-warning)", fontWeight: 700, fontSize: 11 }}>Mgmt Fee</span>;
      default:
        return <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(100, 116, 139, 0.12)", color: "var(--color-slate-600)", fontWeight: 700, fontSize: 11 }}>{rawType || "Invoice"}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <KpiStrip>
        <KpiCard icon="🧾" iconBg="rgba(79,70,229,0.12)" iconColor="var(--color-indigo)" label="Total Billed" value={kM(totalBilled)} sub={`${kN(dueThisMonth)} due this month`} />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="var(--color-success)" label="Collected" value={kM(collected)} sub={`${collectionRate}% collection rate`} />
        <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="var(--color-danger)" label="Outstanding" value={kM(outstanding)} sub="Unpaid balances" link="View arrears" onClick={() => setTab("arrears")} />
        <KpiCard icon="📅" iconBg="rgba(234,88,12,0.12)" iconColor="var(--color-orange)" label="Due This Month" value={kN(dueThisMonth)} sub="Open invoices" />
      </KpiStrip>

      <ViewToolbar
        title="Invoice Register"
        subtitle="Authoritative ledger of issued invoices and lifecycle status"
        search={search}
        onSearch={setSearch}
        placeholder="Search invoice number, tenant, property or type…"
      >
        <button
          className="btn ghost sm"
          onClick={() =>
            exportCsv(
              selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices,
              [
                { key: "number", label: "Invoice No" },
                { key: "invoice_type", label: "Type" },
                { key: "tenant_name", label: "Tenant" },
                { key: "due_on", label: "Due Date" },
                { key: "amount", label: "Amount" },
                { key: "balance", label: "Balance" },
                { key: "status", label: "Status" },
              ],
              "invoice-register.csv"
            )
          }
        >
          Export CSV {selectedInvoices.length > 0 ? `(${selectedInvoices.length})` : ""}
        </button>
      </ViewToolbar>

      {/* Period & Charge Type Navigation Bar */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        {/* Left: Period Month Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 11 }}>
            Period:
          </span>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "var(--surface-2)" }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ padding: "4px 8px", borderRadius: 0, height: 28 }}
              onClick={() => changeMonth(-1)}
              title="Previous Month"
            >
              ◀
            </button>
            <span style={{ padding: "4px 12px", fontWeight: 700, fontSize: 12, color: periodMode === "month" ? "var(--primary)" : "var(--text)" }}>
              {periodMode === "month" ? formattedSelectedMonth : "All Time"}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              style={{ padding: "4px 8px", borderRadius: 0, height: 28 }}
              onClick={() => changeMonth(1)}
              title="Next Month"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            className={`btn sm ${periodMode === "all" ? "primary" : "ghost"}`}
            style={{ fontSize: 11, height: 28 }}
            onClick={() => setPeriodMode(periodMode === "all" ? "month" : "all")}
          >
            {periodMode === "all" ? "✓ All Periods" : "Show All Periods"}
          </button>
        </div>

        {/* Right: Invoice Type Filter Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 11 }}>
            Charge:
          </span>
          {([
            { key: "all", label: "All", count: counts.charge.all },
            { key: "rent", label: "Rent", count: counts.charge.rent },
            { key: "service_charge", label: "Service Charge", count: counts.charge.service_charge },
            { key: "utility", label: "Utilities", count: counts.charge.utility },
            { key: "management_fee", label: "Mgmt Fees", count: counts.charge.management_fee },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn sm ${typeFilter === t.key ? "primary" : "ghost"}`}
              style={{ fontSize: 11, height: 26, padding: "2px 10px" }}
              onClick={() => setTypeFilter(t.key)}
            >
              {t.label} <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 3 }}>({t.count ?? 0})</span>
            </button>
          ))}

          {/* Recipient Type Chips — separates tenant from owner invoices */}
          <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 11, marginLeft: 8 }}>
            Recipient:
          </span>
          {([
            { key: "all", label: "All", count: counts.recipient.all },
            { key: "tenant", label: "Tenants", count: counts.recipient.tenant },
            { key: "owner", label: "Owners", count: counts.recipient.owner },
          ] as const).map((r) => (
            <button
              key={r.key}
              type="button"
              className={`btn sm ${recipientFilter === r.key ? "primary" : "ghost"}`}
              style={{ fontSize: 11, height: 26, padding: "2px 10px" }}
              onClick={() => setRecipientFilter(r.key as any)}
            >
              {r.label} <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 3 }}>({r.count ?? 0})</span>
            </button>
          ))}
        </div>

      </Box>

      {/* Lifecycle Status Filter Strip */}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {([
            ["all", `All (${counts.status.all ?? 0})`],
            ["draft", `Draft (${counts.status.draft ?? 0})`],
            ["issued", `Issued (${counts.status.issued ?? 0})`],
            ["partial", `Partially Paid (${counts.status.partial ?? 0})`],
            ["paid", `Paid (${counts.status.paid ?? 0})`],
            ["overdue", `Overdue (${counts.status.overdue ?? 0})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn sm ${statusFilter === id ? "primary" : "ghost"}`}
              style={{ fontSize: 12 }}
              onClick={() => setStatusFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>


        {selectedIds.size > 0 && (
          <div
            className="row"
            style={{
              gap: 10,
              padding: "6px 14px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <strong>{selectedIds.size} selected ({kM(selectedTotalAmount)})</strong>
            {draftSelected.length > 0 && canFinance && (
              <button className="fc-toolbar-btn primary" onClick={() => handleBatchAction("submit-review")}>
                Submit ({draftSelected.length})
              </button>
            )}
            {reviewSelected.length > 0 && canApprove && (
              <button className="fc-toolbar-btn primary" onClick={() => handleBatchAction("approve")}>
                Approve ({reviewSelected.length})
              </button>
            )}
            {approvedSelected.length > 0 && canApprove && (
              <button className="fc-toolbar-btn primary" onClick={() => handleBatchAction("issue")}>
                Issue ({approvedSelected.length})
              </button>
            )}
            <button className="fc-toolbar-btn" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}
      </div>

      <Panel title={`Invoices ${periodMode === "month" ? `— ${formattedSelectedMonth}` : "— All Time"}`}>
        <ListState
          loading={loading}
          empty={filteredInvoices.length === 0}
          emptyTitle={periodMode === "month" ? `No invoices found for ${formattedSelectedMonth}` : "No invoices found"}
          emptyDesc={
            periodMode === "month"
              ? `No invoices match the selected filters for ${formattedSelectedMonth}. Invoices generated in the Billing Pipeline will appear here.`
              : "Invoices created in the billing pipeline will appear here."
          }
        >
          {filteredInvoices.length === 0 && periodMode === "month" && (
            <div style={{ padding: "16px", textAlign: "center" }}>
              <button className="btn primary sm" onClick={() => setTab("billing")}>
                Open Billing Pipeline for {formattedSelectedMonth} →
              </button>
            </div>
          )}
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Invoice No</th>
                  <th>Type</th>
                  <th>Tenant / Recipient</th>
                  <th>Property</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const isSelected = selectedIds.has(String(inv.id));
                  const bal = Number(inv.balance ?? 0);
                  const amt = Number(inv.amount ?? 0);
                  const isPartial = bal > 0 && bal < amt;
                  const isOverdue = bal > 0 && inv.due_on && new Date(String(inv.due_on)) < new Date();

                  return (
                    <tr
                      key={String(inv.id)}
                      onClick={() => onSelectRow(inv)}
                      style={{ background: isSelected ? "rgba(79, 70, 229, 0.05)" : undefined }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectOne(String(inv.id), e as any)}
                        />
                      </td>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>
                        {String(inv.number ?? "—")}
                      </td>
                      <td>
                        {getTypeBadge(inv.invoice_type)}
                      </td>
                      <td>
                        <strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {String((inv.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {fmtDate(inv.due_on)}
                        {isOverdue && (
                          <span style={{ color: "var(--danger)", fontSize: 10, display: "block", fontWeight: 700 }}>
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="mono">{kM(inv.amount)}</td>
                      <td className="mono" style={{ color: bal > 0 ? "var(--danger)" : "var(--color-success)", fontWeight: 700 }}>
                        {kM(inv.balance)}
                        {isPartial && (
                          <span style={{ display: "block", fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
                            Partial
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusPill value={String(inv.status ?? "—")} />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                          {bal > 0 && (
                            <button
                              className="btn ghost sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRecordReceipt(String(inv.id));
                              }}
                            >
                              Pay
                            </button>
                          )}
                          <button
                            className="fc-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadPdf(inv);
                            }}
                            title="Download PDF invoice"
                          >
                            PDF
                          </button>
                          {bal > 0 && !["draft", "void", "paid"].includes(String(inv.status)) && (
                            <button
                              className="fc-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendReminder(inv);
                              }}
                              title="Send payment reminder"
                            >
                              Remind
                            </button>
                          )}
                          {inv.status === "draft" && canFinance && (
                            <button
                              className="fc-action-btn primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "submit-review");
                              }}
                              title="Submit draft invoice for approval"
                            >
                              Submit
                            </button>
                          )}
                          {inv.status === "review" && canApprove && (
                            <button
                              className="fc-action-btn success"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "approve");
                              }}
                              title="Confirm and approve invoice"
                            >
                              Confirm
                            </button>
                          )}
                          {inv.status === "approved" && canApprove && (
                            <button
                              className="fc-action-btn primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "issue");
                              }}
                              title="Issue invoice to tenant"
                            >
                              Issue
                            </button>
                          )}
                          {["draft", "issued", "overdue"].includes(String(inv.status)) && (
                            <button
                              className="fc-action-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "void");
                              }}
                              title="Void invoice"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      <Box sx={{ display: "grid", gap: 16, width: "100%", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <Panel title="Collection Performance">
          {totalBilled > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", background: `conic-gradient(var(--primary) 0% ${collectionRate}%, var(--surface-3) ${collectionRate}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{collectionRate}%</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Collected
                  </span>
                  <strong className="mono">{kM(collected)}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--surface-3)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Outstanding
                  </span>
                  <strong className="mono">{kM(outstanding)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No billing data" description="Generate invoices to view collection analytics." />
          )}
        </Panel>

        <Panel title="Aging Summary">
          {agingTotal > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px" }}>
              {agingBuckets.map(({ label, key }) => {
                const val = Number((aging as Record<string, unknown>)[key] ?? 0);
                const p = pct(val, agingTotal);
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                      <span className="muted">{label}</span>
                      <strong className="mono">{kM(val)} ({p}%)</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p}%`, background: key === "current" ? "var(--primary)" : key === "31_60" ? "#eab308" : "var(--danger)", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No aging data" description="Overdue balances will show aging bucket analytics." />
          )}
        </Panel>
      </Box>
    </div>
  );
}
