"use client";

import { useState, useMemo } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  DetailDrawer,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import { PropertyTab, Row, ID, ReceiptAllocationRow } from "../../types/property.types";
import { kM, kN, fmtDate, shortId, exportCsv } from "../../utils/property.utils";
import { apiFetch, csrfFromCookie } from "@/lib/api";

export function ReceiptAllocationsView({
  rows,
  loading,
  search,
  setSearch,
  setTab = () => {},
  onRefresh = () => {},
  organizationId,
  canFinance = true,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRefresh?: () => void;
  organizationId?: string;
  canFinance?: boolean;
}) {
  const allocations = rows as ReceiptAllocationRow[];
  const [filterTenant, setFilterTenant] = useState("");
  const [autoAllocating, setAutoAllocating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<ReceiptAllocationRow | null>(null);

  const totalAllocated = useMemo(() => {
    return allocations.reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
  }, [allocations]);

  const uniqueTenants = useMemo(() => {
    return [...new Set(allocations.map((a) => a.tenant_name).filter(Boolean))];
  }, [allocations]);

  const uniqueInvoicesCount = useMemo(() => {
    return new Set(allocations.map((a) => a.invoice).filter(Boolean)).size;
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (filterTenant && a.tenant_name !== filterTenant) return false;
      return true;
    });
  }, [allocations, filterTenant]);

  const siblingAllocations = useMemo(() => {
    if (!selectedAllocation) return [];
    return allocations.filter(
      (a) => a.receipt_number === selectedAllocation.receipt_number
    );
  }, [allocations, selectedAllocation]);

  async function handleAutoAllocate() {
    if (!confirm("Run FIFO Auto-Allocation? This will automatically match unapplied tenant receipts to their oldest outstanding invoices.")) {
      return;
    }
    setAutoAllocating(true);
    setFeedback(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/property/receipt-allocations/auto-allocate/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({}),
      }, organizationId);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({
          type: "success",
          message: data.detail || `Auto-allocation completed: ${data.allocated_count ?? 0} invoices matched.`,
        });
        onRefresh();
      } else {
        setFeedback({
          type: "error",
          message: data.detail || data.message || "Failed to complete auto-allocation.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error while triggering auto-allocation." });
    } finally {
      setAutoAllocating(false);
    }
  }

  async function handleReverseAllocation(allocation: ReceiptAllocationRow) {
    if (!confirm(`Reverse allocation of ${kM(allocation.amount)} from invoice ${allocation.invoice_number ?? ""}? This will restore the balance to the unapplied receipt.`)) {
      return;
    }
    setFeedback(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/property/receipt-allocations/${allocation.id}/reverse/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({}),
      }, organizationId);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({
          type: "success",
          message: data.detail || "Allocation reversed successfully. Balance restored.",
        });
        setSelectedAllocation(null);
        onRefresh();
      } else {
        setFeedback({
          type: "error",
          message: data.detail || data.message || "Failed to reverse allocation.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error while reversing allocation." });
    }
  }

  const selStyle = {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <KpiStrip cols={4}>
        <KpiCard
          icon="🔗"
          iconBg="#e0e7ff"
          iconColor="#4f46e5"
          label="Total Allocated"
          value={kM(totalAllocated)}
          sub="Applied against invoices"
        />
        <KpiCard
          icon="🧾"
          iconBg="#dbeafe"
          iconColor="#0284c7"
          label="Allocations"
          value={kN(allocations.length)}
          sub="Ledger transactions"
        />
        <KpiCard
          icon="🏢"
          iconBg="#dcfce7"
          iconColor="#16a34a"
          label="Invoices Settled"
          value={kN(uniqueInvoicesCount)}
          sub="Covered by collections"
        />
        <KpiCard
          icon="⚡"
          iconBg="#fef3c7"
          iconColor="#d97706"
          label="FIFO Engine"
          value="Active"
          sub="Automated clearing"
        />
      </KpiStrip>

      {feedback && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            background: feedback.type === "success" ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
            color: feedback.type === "success" ? "#16a34a" : "#dc2626",
            border: `1px solid ${feedback.type === "success" ? "rgba(22, 163, 74, 0.2)" : "rgba(220, 38, 38, 0.2)"}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      <ViewToolbar
        title="Receipt Allocations"
        subtitle="Ledger mapping tenant payments to specific open invoices"
        search={search}
        onSearch={setSearch}
        placeholder="Search receipt, invoice or tenant…"
      >
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          style={selStyle}
        >
          <option value="">All Tenants</option>
          {uniqueTenants.map((t) => (
            <option key={String(t)} value={String(t)}>
              {String(t)}
            </option>
          ))}
        </select>

        <button
          className="btn ghost sm"
          onClick={() =>
            exportCsv(
              filteredAllocations,
              [
                { key: "id", label: "Allocation ID" },
                { key: "receipt_number", label: "Receipt No" },
                { key: "invoice_number", label: "Invoice No" },
                { key: "tenant_name", label: "Tenant" },
                { key: "amount", label: "Allocated Amount" },
                { key: "created_at", label: "Date" },
              ],
              "receipt-allocations.csv"
            )
          }
        >
          Export CSV
        </button>

        {canFinance && (
          <button
            className="btn primary sm"
            disabled={autoAllocating}
            style={{
              background: "#0284c7",
              color: "#ffffff",
              fontWeight: 700,
            }}
            onClick={handleAutoAllocate}
          >
            {autoAllocating ? "Allocating..." : "⚡ Auto-Allocate (FIFO)"}
          </button>
        )}
      </ViewToolbar>

      <Panel title="Allocations Ledger">
        <ListState
          loading={loading}
          empty={filteredAllocations.length === 0}
          emptyTitle="No allocations found"
          emptyDesc="When receipts are matched to invoices, allocation records will appear here."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Allocation Ref</th>
                  <th>Receipt No</th>
                  <th>Invoice No</th>
                  <th>Tenant</th>
                  <th>Allocated Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.map((a) => (
                  <tr
                    key={String(a.id)}
                    onClick={() => setSelectedAllocation(a)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>
                      {shortId(a.id)}
                    </td>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {String(a.receipt_number ?? "—")}
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: "#0284c7" }}>
                      {String(a.invoice_number ?? "—")}
                    </td>
                    <td>
                      <strong style={{ fontSize: 12 }}>{String(a.tenant_name ?? "—")}</strong>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: "#16a34a" }}>
                      {kM(a.amount)}
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(a.created_at)}</td>
                    <td>
                      <Badge tone="green">Applied</Badge>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn ghost sm"
                          onClick={() => setSelectedAllocation(a)}
                        >
                          Details
                        </button>
                        {canFinance && (
                          <button
                            className="btn ghost sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleReverseAllocation(a)}
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      {selectedAllocation && (
        <DetailDrawer
          title={`Allocation #${shortId(selectedAllocation.id)}`}
          onClose={() => setSelectedAllocation(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
              <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>
                Target Invoice
              </span>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {String(selectedAllocation.invoice_number ?? "Invoice")}
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                <span className="muted">Tenant:</span>
                <strong>{String(selectedAllocation.tenant_name ?? "—")}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 4, fontSize: 12 }}>
                <span className="muted">Allocated Amount:</span>
                <strong className="mono" style={{ color: "#16a34a" }}>{kM(selectedAllocation.amount)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 4, fontSize: 12 }}>
                <span className="muted">Allocation Date:</span>
                <span>{fmtDate(selectedAllocation.created_at)}</span>
              </div>
            </div>

            {siblingAllocations.length > 1 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--muted)" }}>
                  Other Allocations from Receipt {String(selectedAllocation.receipt_number)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {siblingAllocations.map((sib) => (
                    <div
                      key={String(sib.id)}
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "var(--surface-3)",
                        fontSize: 12,
                      }}
                    >
                      <span className="mono">{String(sib.invoice_number)}</span>
                      <strong className="mono">{kM(sib.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                className="btn ghost sm"
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedAllocation(null);
                  setTab("billing");
                }}
              >
                Go to Invoices
              </button>
              {canFinance && (
                <button
                  className="btn ghost sm"
                  style={{ flex: 1, color: "var(--danger)" }}
                  onClick={() => handleReverseAllocation(selectedAllocation)}
                >
                  Reverse Allocation
                </button>
              )}
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
