"use client";

import { useState, useMemo } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  Pagination,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import { PropertyTab, Row, ID, ReceiptRow } from "../../types/property.types";
import { kM, kN, fmtDate, exportCsv } from "../../utils/property.utils";

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
    rent:           { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
    service_charge: { bg: "rgba(139,92,246,0.12)",  color: "#7c3aed" },
    utility:        { bg: "rgba(20,184,166,0.12)",  color: "#0d9488" },
    management_fee: { bg: "rgba(245,158,11,0.12)",  color: "#d97706" },
    other:          { bg: "rgba(100,116,139,0.12)", color: "#475569" },
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const receipts = currentReceipts;
  const receiptTotal = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const appliedTotal = receipts.filter((r) => r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const unappliedTotal = receipts.filter((r) => !r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const tenantNames = [...new Set(receipts.map((r) => r.tenant_name).filter(Boolean))];
  const paymentMethods = [...new Set(receipts.map((r) => r.payment_method).filter(Boolean))];

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

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard
          icon="🧾"
          iconBg="#e0e7ff"
          iconColor="#4f46e5"
          label="Total Collected"
          value={kM(receiptTotal)}
          sub="Gross collections"
        />
        <KpiCard
          icon="✓"
          iconBg="#dcfce7"
          iconColor="#16a34a"
          label="Applied Receipts"
          value={kM(appliedTotal)}
          sub="Allocated to invoices"
          link="View applied"
          onClick={() => setFilter("applied")}
        />
        <KpiCard
          icon="⚠️"
          iconBg="#fee2e2"
          iconColor="#dc2626"
          label="Unapplied Float"
          value={kM(unappliedTotal)}
          sub="Available for allocation"
          link="View unapplied"
          onClick={() => setFilter("unapplied")}
        />
        <KpiCard
          icon="💳"
          iconBg="#fef3c7"
          iconColor="#d97706"
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
            <option value="">All Charge Types</option>
            <option value="rent">Rent</option>
            <option value="service_charge">Service Charge</option>
            <option value="utility">Utilities / Water</option>
            <option value="management_fee">Mgmt Fee</option>
            <option value="other">Other</option>
          </select>
        )}

        {/* Recipient Type — for sectional title (owner vs tenant) */}
        {hasChargeTypeData && (
          <select value={filterRecipientType} onChange={(e) => { setFilterRecipientType(e.target.value); setPage(1); }} style={selStyle}>
            <option value="">All Recipients</option>
            <option value="tenant">Tenant</option>
            <option value="owner">Owner / Landlord</option>
          </select>
        )}

        <button
          className="btn ghost sm"
          onClick={() =>
            exportCsv(
              filtered,
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
              "receipts-ledger.csv"
            )
          }
        >
          Export CSV
        </button>
        {canFinance && (
          <button className="btn primary sm" onClick={() => onRecordReceipt()}>
            + Record Receipt
          </button>
        )}
      </ViewToolbar>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([
          ["all", "All Receipts"],
          ["applied", "Applied to Invoice"],
          ["unapplied", "Unapplied Float"],
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
                {pagedRows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>
                      {String(r.number ?? "—")}
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                    <td>
                      <strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? (r as any).owner_name ?? "—")}</strong>
                      {(r as any).recipient_type === "owner" && (
                        <span style={{ display: "block", fontSize: 10, color: "#7c3aed", fontWeight: 600 }}>Owner</span>
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
                      <Badge tone={r.invoice ? "green" : "yellow"}>
                        {r.invoice ? "Applied" : "Unapplied"}
                      </Badge>
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => onDownloadPdf(r as ReceiptRow)}>
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </ListState>
      </Panel>
    </>
  );
}
