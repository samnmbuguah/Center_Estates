"use client";

import { useState, useMemo } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  Pagination,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import { PropertyTab, Row, ID, ReceiptRow } from "../../types/property.types";
import { kM, kN, fmtDate, exportCsv } from "../../utils/property.utils";

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
    return true;
  });

  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} style={selStyle}>
          <option value="">All Tenants</option>
          {tenantNames.map((t) => (
            <option key={String(t)} value={String(t)}>
              {String(t)}
            </option>
          ))}
        </select>
        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} style={selStyle}>
          <option value="">All Methods</option>
          {paymentMethods.map((m) => (
            <option key={String(m)} value={String(m)}>
              {String(m).replace(/_/g, " ")}
            </option>
          ))}
        </select>
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

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {([
          ["all", "All Receipts"],
          ["applied", "Applied to Invoice"],
          ["unapplied", "Unapplied Float"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn sm ${filter === id ? "primary" : "ghost"}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel title="Receipts">
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
                  <th>Tenant</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Allocation Status</th>
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
                      <strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong>
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
