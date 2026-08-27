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
  onAddInvoice = () => {},
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
  canApprove?: boolean;
  onAddInvoice?: () => void;
  onDownloadPdf?: (row: InvoiceRow) => void;
  onRefresh?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentInvoices = (invoices && invoices.length > 0 ? invoices : (rows && rows.length > 0 ? rows : rentInvoices)) as InvoiceRow[];
  const displayInvoices = (rows && rows.length > 0 ? rows : currentInvoices) as InvoiceRow[];
  
  const totalBilled = currentInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const outstanding = currentInvoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const collectionRate = pct(collected, totalBilled);
  const dueThisMonth = currentInvoices.filter((i) => {
    const d = new Date(String(i.due_on ?? ""));
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && Number(i.balance ?? 0) > 0;
  }).length;

  const filteredInvoices = useMemo(() => {
    return displayInvoices.filter((inv) => {
      if (statusFilter !== "all" && String(inv.status).toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [displayInvoices, statusFilter]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <KpiStrip>
        <KpiCard icon="🧾" iconBg="rgba(79,70,229,0.12)" iconColor="#4f46e5" label="Total Billed" value={kM(totalBilled)} sub={`${kN(dueThisMonth)} due this month`} />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="#16a34a" label="Collected" value={kM(collected)} sub={`${collectionRate}% collection rate`} />
        <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid balances" link="View arrears" onClick={() => setTab("arrears")} />
        <KpiCard icon="📅" iconBg="rgba(234,88,12,0.12)" iconColor="#ea580c" label="Due This Month" value={kN(dueThisMonth)} sub="Open invoices" />
      </KpiStrip>

      <ViewToolbar
        title="Invoice Register"
        subtitle="Authoritative ledger of issued invoices and lifecycle status"
        search={search}
        onSearch={setSearch}
        placeholder="Search invoice number, tenant or property…"
      >
        <button
          className="btn ghost sm"
          onClick={() =>
            exportCsv(
              selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices,
              [
                { key: "number", label: "Invoice No" },
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
        <button className="btn ghost sm" onClick={() => setTab("receipting")}>Receipts & Collections →</button>
        {canFinance && <button className="btn primary sm" onClick={onAddInvoice}>+ New Single Invoice</button>}
      </ViewToolbar>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {[
            ["all", "All Invoices"],
            ["draft", "Draft"],
            ["review", "Under Review"],
            ["approved", "Approved"],
            ["issued", "Issued"],
            ["overdue", "Overdue"],
            ["paid", "Paid"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn sm ${statusFilter === id ? "primary" : "ghost"}`}
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
              <button className="btn primary sm" onClick={() => handleBatchAction("submit-review")}>
                Submit ({draftSelected.length})
              </button>
            )}
            {reviewSelected.length > 0 && canApprove && (
              <button className="btn primary sm" onClick={() => handleBatchAction("approve")}>
                Approve ({reviewSelected.length})
              </button>
            )}
            {approvedSelected.length > 0 && canApprove && (
              <button className="btn primary sm" onClick={() => handleBatchAction("issue")}>
                Issue ({approvedSelected.length})
              </button>
            )}
            <button className="btn ghost sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}
      </div>

      <Panel title="Invoices">
        <ListState loading={loading} empty={filteredInvoices.length === 0} emptyTitle="No invoices found" emptyDesc="Invoices created in the billing pipeline will appear here.">
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
                  <th>Tenant</th>
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
                      <td className="mono" style={{ color: bal > 0 ? "var(--danger)" : "#16a34a", fontWeight: 700 }}>
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
                            className="btn ghost sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadPdf(inv);
                            }}
                          >
                            PDF
                          </button>
                          {bal > 0 && !["draft", "void", "paid"].includes(String(inv.status)) && (
                            <button
                              className="btn ghost sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendReminder(inv);
                              }}
                            >
                              Remind
                            </button>
                          )}
                          {inv.status === "draft" && canFinance && (
                            <button
                              className="btn primary sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "submit-review");
                              }}
                            >
                              Submit
                            </button>
                          )}
                          {inv.status === "review" && canApprove && (
                            <button
                              className="btn primary sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "approve");
                              }}
                            >
                              Confirm
                            </button>
                          )}
                          {inv.status === "approved" && canApprove && (
                            <button
                              className="btn primary sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "issue");
                              }}
                            >
                              Issue
                            </button>
                          )}
                          {["draft", "issued", "overdue"].includes(String(inv.status)) && (
                            <button
                              className="btn ghost sm"
                              style={{ color: "var(--danger)" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceAction(inv, "void");
                              }}
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
