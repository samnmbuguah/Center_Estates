"use client";

import { useState, useMemo } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  Pagination,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import { PropertyTab, Row, ID, ReceiptRow } from "../../types/property.types";
import { kM, kN, fmtDate, exportCsv } from "../../utils/property.utils";
import { Download, FileText, CheckSquare, Square, X } from "lucide-react";

const CHARGE_TYPE_LABELS: Record<string, string> = {
  rent: "Rent",
  service_charge: "Service Charge",
  sc: "Service Charge",
  water: "Water",
  utility: "Utilities",
  management_fee: "Mgmt Fee",
};

function normalizeChargeType(raw?: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "rent") return "rent";
  if (s === "sc" || s === "service_charge" || s.includes("service")) return "service_charge";
  if (s === "water" || s === "electricity" || s.includes("utility")) return "utility";
  if (s.includes("mgmt") || s.includes("management") || s.includes("commission")) return "management_fee";
  return "other";
}

function ChargeTypeBadge({ chargeType }: { chargeType?: string }) {
  const norm = normalizeChargeType(chargeType);
  const styles: Record<string, { bg: string; color: string }> = {
    rent:           { bg: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
    service_charge: { bg: "rgba(139,92,246,0.12)",  color: "var(--color-violet)" },
    utility:        { bg: "rgba(20,184,166,0.12)",  color: "var(--color-teal)" },
    management_fee: { bg: "rgba(245,158,11,0.12)",  color: "var(--color-warning)" },
    other:          { bg: "rgba(100,116,139,0.12)", color: "var(--text-soft)" },
  };
  const s = styles[norm] ?? styles.other;
  return (
    <span style={{ padding: "2px 7px", borderRadius: 4, background: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }}>
      {CHARGE_TYPE_LABELS[norm] ?? (chargeType || "—")}
    </span>
  );
}

export function ReceiptsView({
  rows,
  receipts: propReceipts,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  onRecordReceipt = () => {},
  onDownloadPdf = () => {},
  canFinance = true,
  onRefresh = () => {},
}: {
  rows?: Row[];
  receipts?: Row[];
  creditNotes?: Row[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onAddCreditNote?: () => void;
  onDownloadPdf?: (row: ReceiptRow) => void;
  canFinance?: boolean;
  onRefresh?: () => void;
}) {
  const currentReceipts = (propReceipts || rows || []) as ReceiptRow[];
  const [filter, setFilter] = useState<"all" | "applied" | "unapplied">("all");
  const [filterTenant, setFilterTenant] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterChargeType, setFilterChargeType] = useState("");
  const [filterRecipientType, setFilterRecipientType] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const receipts = currentReceipts;
  const receiptTotal = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const appliedTotal = receipts.filter((r) => r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const unappliedTotal = receipts.filter((r) => !r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const tenantNames = [...new Set(receipts.map((r) => r.tenant_name).filter(Boolean))];
  const paymentMethods = [...new Set(receipts.map((r) => r.payment_method).filter(Boolean))];

  // Dynamic distribution counts
  const counts = useMemo(() => {
    const charge: Record<string, number> = { rent: 0, service_charge: 0, utility: 0, management_fee: 0, other: 0 };
    const recipient: Record<string, number> = { tenant: 0, owner: 0 };
    const appliedCount = receipts.filter((r) => Boolean(r.invoice)).length;
    const unappliedCount = receipts.filter((r) => !r.invoice).length;

    for (const r of receipts) {
      const ct = normalizeChargeType((r as any).charge_type);
      charge[ct] = (charge[ct] || 0) + 1;
      const rt = String((r as any).recipient_type || "tenant").toLowerCase();
      recipient[rt] = (recipient[rt] || 0) + 1;
    }

    return { charge, recipient, appliedCount, unappliedCount, total: receipts.length };
  }, [receipts]);

  const selStyle = {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    fontSize: 13,
  };

  const filtered = receipts.filter((r) => {
    if (filter === "applied" && !r.invoice) return false;
    if (filter === "unapplied" && r.invoice) return false;
    if (filterTenant && r.tenant_name !== filterTenant) return false;
    if (filterMethod && r.payment_method !== filterMethod) return false;
    if (filterChargeType) {
      const ct = normalizeChargeType((r as any).charge_type);
      if (ct !== filterChargeType) return false;
    }
    if (filterRecipientType) {
      const rt = String((r as any).recipient_type || "tenant").toLowerCase();
      if (rt !== filterRecipientType) return false;
    }
    return true;
  });

  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasChargeTypeData = receipts.some((r) => !!(r as any).charge_type);
  const anyActiveFilters = !!(filterChargeType || filterRecipientType || filterTenant || filterMethod);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === pagedRows.length && pagedRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedRows.map((r) => String(r.id))));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedRows = receipts.filter((r) => selectedIds.has(String(r.id)));
  const selectedAmountTotal = selectedRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const exportSelectionCsv = () => {
    const targets = selectedRows.length > 0 ? selectedRows : filtered;
    exportCsv(
      targets,
      [
        { key: "number", label: "Receipt No" },
        { key: "received_on", label: "Date" },
        { key: "tenant_name", label: "Tenant" },
        { key: "payment_method", label: "Method" },
        { key: "external_reference", label: "Reference" },
        { key: "charge_type", label: "Charge Type" },
        { key: "recipient_type", label: "Recipient" },
        { key: "amount", label: "Amount" },
      ],
      selectedRows.length > 0 ? `receipts-selected-${selectedRows.length}.csv` : "receipts-ledger.csv"
    );
  };

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard
          icon="🧾"
          iconBg="var(--color-indigo-bg)"
          iconColor="var(--color-indigo)"
          label="Total Collected"
          value={kM(receiptTotal)}
          sub="Gross collections"
        />
        <KpiCard
          icon="✓"
          iconBg="var(--color-green-bg)"
          iconColor="var(--color-success)"
          label="Applied Receipts"
          value={kM(appliedTotal)}
          sub="Allocated to invoices"
          link="View applied"
          onClick={() => setFilter("applied")}
        />
        <KpiCard
          icon="⚠️"
          iconBg="var(--color-red-bg)"
          iconColor="var(--color-danger)"
          label="Unapplied Float"
          value={kM(unappliedTotal)}
          sub="Available for allocation"
          link="View unapplied"
          onClick={() => setFilter("unapplied")}
        />
        <KpiCard
          icon="💳"
          iconBg="var(--color-amber-bg)"
          iconColor="var(--color-warning)"
          label="Payment Volume"
          value={kN(receipts.length)}
          sub="Transactions recorded"
        />
      </KpiStrip>

      <ViewToolbar
        title="Receipts Ledger"
        subtitle="Recorded tenant payments, bank deposits, and M-Pesa collections"
        search={search}
        onSearch={setSearch}
        placeholder="Search receipt number, tenant or M-Pesa reference…"
      >
        <select value={filterTenant} onChange={(e) => { setFilterTenant(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">All Tenants</option>
          {tenantNames.map((t) => (
            <option key={String(t)} value={String(t)}>{String(t)}</option>
          ))}
        </select>

        <select value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">All Methods</option>
          {paymentMethods.map((m) => (
            <option key={String(m)} value={String(m)}>{String(m).replace(/_/g, " ")}</option>
          ))}
        </select>

        {/* Charge Type — only shown when receipts carry invoice_type data */}
        {hasChargeTypeData && (
          <select value={filterChargeType} onChange={(e) => { setFilterChargeType(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">All Charge Types ({counts.total})</option>
            <option value="rent">Rent ({counts.charge.rent})</option>
            <option value="service_charge">Service Charge ({counts.charge.service_charge})</option>
            <option value="utility">Utilities / Water ({counts.charge.utility})</option>
            <option value="management_fee">Mgmt Fee ({counts.charge.management_fee})</option>
            <option value="other">Other ({counts.charge.other})</option>
          </select>
        )}

        {/* Recipient Type — for sectional title (owner vs tenant) */}
        {hasChargeTypeData && (
          <select value={filterRecipientType} onChange={(e) => { setFilterRecipientType(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">All Recipients ({counts.total})</option>
            <option value="tenant">Tenants ({counts.recipient.tenant})</option>
            <option value="owner">Owners / Landlords ({counts.recipient.owner})</option>
          </select>
        )}

        <button
          className="fc-toolbar-btn"
          onClick={exportSelectionCsv}
        >
          <Download size={13} style={{ marginRight: 4 }} />
          Export CSV
        </button>
        {canFinance && (
          <button className="fc-toolbar-btn primary" onClick={() => onRecordReceipt()}>
            + Record Receipt
          </button>
        )}
      </ViewToolbar>

      {/* Floating / Sticky Bulk Action Bar when rows are selected */}
      {selectedIds.size > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderRadius: 8,
          background: "linear-gradient(90deg, rgba(79,70,229,0.15) 0%, rgba(99,102,241,0.1) 100%)",
          border: "1px solid rgba(99,102,241,0.3)",
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckSquare size={16} color="var(--color-indigo-strong)" />
            <span>
              <strong>{selectedIds.size}</strong> receipt{selectedIds.size === 1 ? "" : "s"} selected · Total: <strong style={{ color: "var(--primary)" }}>{kM(selectedAmountTotal)}</strong>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn ghost sm" onClick={exportSelectionCsv} style={{ fontSize: 12 }}>
              <Download size={12} style={{ marginRight: 4 }} /> Export Selected CSV ({selectedIds.size})
            </button>
            <button className="btn ghost sm" onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, color: "var(--muted)" }}>
              <X size={12} style={{ marginRight: 4 }} /> Deselect All
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([
          ["all", `All Receipts (${counts.total})`],
          ["applied", `Applied (${counts.appliedCount})`],
          ["unapplied", `Unapplied Float (${counts.unappliedCount})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn sm ${filter === id ? "primary" : "ghost"}`}
            onClick={() => { setFilter(id); setPage(1); }}
          >
            {label}
          </button>
        ))}

        {anyActiveFilters && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ color: "var(--danger)", fontSize: 12 }}
            onClick={() => {
              setFilterChargeType("");
              setFilterRecipientType("");
              setFilterTenant("");
              setFilterMethod("");
              setPage(1);
            }}
          >
            ✕ Clear Filters
          </button>
        )}
      </div>

      <Panel title={`Receipts (${filtered.length}${filtered.length !== receipts.length ? ` of ${receipts.length}` : ""})`}>
        <ListState
          loading={loading}
          empty={filtered.length === 0}
          emptyTitle="No receipts found"
          emptyDesc="Recorded tenant payments will appear in this ledger."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pagedRows.length && pagedRows.length > 0}
                      onChange={toggleSelectAll}
                      title="Select all on this page"
                    />
                  </th>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Tenant / Payer</th>
                  <th>Charge Type</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Allocation</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => {
                  const isSelected = selectedIds.has(String(r.id));
                  return (
                    <tr key={String(r.id)} style={isSelected ? { background: "rgba(99,102,241,0.06)" } : undefined}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(String(r.id))}
                        />
                      </td>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>
                        {String(r.number ?? "—")}
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                      <td>
                        <strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? (r as any).owner_name ?? "—")}</strong>
                        {(r as any).recipient_type === "owner" && (
                          <span style={{ display: "block", fontSize: 10, color: "var(--color-violet)", fontWeight: 600 }}>Owner</span>
                        )}
                      </td>
                      <td>
                        {(r as any).charge_type ? (
                          <ChargeTypeBadge chargeType={(r as any).charge_type} />
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, textTransform: "capitalize" }}>
                        {String(r.payment_method ?? "—").replace(/_/g, " ")}
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                        {String(r.external_reference ?? "—")}
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                        {kM(r.amount)}
                      </td>
                      <td>
                        <StatusPill tone={r.invoice ? "green" : "yellow"}>
                          {r.invoice ? "Applied" : "Unapplied"}
                        </StatusPill>
                      </td>
                      <td>
                        <button className="fc-action-btn" onClick={() => onDownloadPdf(r as ReceiptRow)} title="Download PDF receipt">
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </ListState>
      </Panel>
    </>
  );
}
