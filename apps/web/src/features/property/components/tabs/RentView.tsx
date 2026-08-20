"use client";

import { useState, useMemo } from "react";
import { Box } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, InvoiceRow, AgingTenantRow, AgingAnalytics,
} from "../../types/property.types";
import { kM, kN, fmtDate, pct } from "../../utils/property.utils";

function renderInvoiceRows(
  invoices: InvoiceRow[],
  onPay: (id: ID) => void,
  onRemind: (row: InvoiceRow) => void,
  onAction: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void,
  onSelect: (r: Row) => void,
  onDownloadPdf: (row: InvoiceRow) => void,
  canFinance: boolean,
  canApprove: boolean,
) {
  return invoices.map((inv) => (
    <tr key={String(inv.id)} onClick={() => onSelect(inv)}>
      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(inv.number ?? "—")}</td>
      <td><strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong></td>
      <td style={{ fontSize: 12 }}>{String((inv.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</td>
      <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
      <td className="mono">{kM(inv.amount)}</td>
      <td className="mono" style={{ color: Number(inv.balance ?? 0) > 0 ? "var(--danger)" : "#16a34a" }}>{kM(inv.balance)}</td>
      <td><StatusPill value={String(inv.status ?? "—")} /></td>
      <td>
        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
          {Number(inv.balance ?? 0) > 0 && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onPay(String(inv.id)); }}>Pay</button>}
          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onDownloadPdf(inv); }}>PDF</button>
          {Number(inv.balance ?? 0) > 0 && !["draft", "void", "paid"].includes(String(inv.status)) && (
            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onRemind(inv); }}>Remind</button>
          )}
          {inv.status === "draft" && canFinance && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "submit-review"); }}>Submit</button>}
          {inv.status === "review" && canApprove && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "approve"); }}>Approve</button>}
          {inv.status === "approved" && canApprove && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "issue"); }}>Issue</button>}
          {["draft", "issued", "overdue"].includes(String(inv.status)) && (
            <button className="btn ghost sm" style={{ color: "var(--danger)" }} onClick={(e) => { e.stopPropagation(); onAction(inv, "void"); }}>Void</button>
          )}
        </div>
      </td>
    </tr>
  ));
}

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
  const currentInvoices = invoices || rentInvoices;
  const displayInvoices = rows as InvoiceRow[];
  const totalBilled = currentInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const outstanding = currentInvoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const collectionRate = pct(collected, totalBilled);
  const dueThisMonth = currentInvoices.filter((i) => {
    const d = new Date(String(i.due_on ?? ""));
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && Number(i.balance ?? 0) > 0;
  }).length;
  const aging = analytics?.summary ?? {};
  const agingTotal = Object.values(aging).reduce((s, v) => s + Number(v ?? 0), 0);
  const agingBuckets = [
    { label: "Current (0-30)", key: "current" },
    { label: "31-60 days", key: "31_60" },
    { label: "61-90 days", key: "61_90" },
    { label: "91-120 days", key: "91_120" },
    { label: "120+ days", key: "over_120" },
  ];
  const topTenants = analytics?.tenants ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <KpiStrip>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Billed" value={kM(totalBilled)} sub={`${kN(dueThisMonth)} due this month`} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Collected" value={kM(collected)} sub={`${collectionRate}% collection rate`} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid balances" link="View arrears" onClick={() => setTab("arrears")} />
        <KpiCard icon="📅" iconBg="#fff7ed" iconColor="#ea580c" label="Due This Month" value={kN(dueThisMonth)} sub="Open invoices" />
      </KpiStrip>

      <ViewToolbar
        title="Invoice Register"
        subtitle="All invoices with lifecycle actions"
        search={search}
        onSearch={setSearch}
        placeholder="Search invoice number, tenant or property…"
      >
        <button className="btn ghost sm" onClick={() => setTab("rent-schedules")}>Rent Schedules →</button>
        <button className="btn ghost sm" onClick={() => setTab("payments")}>Payments →</button>
        {canFinance && (
          <button
            className="btn primary sm"
            style={{
              background: "#0284c7",
              color: "#ffffff",
              fontWeight: 800,
              padding: "6px 14px",
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
            }}
            onClick={() => setTab("billing")}
          >
            ⚡ Bulk Invoice Property
          </button>
        )}
        {canFinance && <button className="btn primary sm" onClick={onAddInvoice}>+ New Single Invoice</button>}
      </ViewToolbar>

      <Panel
        title="Invoices"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Payment</button>
          </div>
        }
      >
        <ListState loading={loading} empty={displayInvoices.length === 0} emptyTitle="No invoices found" emptyDesc="Generate invoices from rent schedules or create a single invoice.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
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
              <tbody>{renderInvoiceRows(displayInvoices, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow, onDownloadPdf, canFinance, canApprove)}</tbody>
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
            <EmptyState icon="🧾" title="No billing data" description="Generate invoices to see collection performance." />
          )}
        </Panel>

        <Panel title="Aging Summary" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Full Report →</button>}>
          {agingTotal > 0 ? (
            <div style={{ padding: "12px 16px" }}>
              {agingBuckets.map((b) => {
                const amount = Number(aging[b.key] ?? 0);
                return (
                  <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, width: 110, color: "var(--muted)" }}>{b.label}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ width: `${pct(amount, agingTotal)}%`, height: "100%", background: amount > 0 ? "#e23b3b" : "var(--border-strong)", transition: "width 0.3s" }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12, width: 80, textAlign: "right", color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding balances" description="All invoices have been collected." />
          )}
        </Panel>
      </Box>

      {topTenants.length > 0 && (
        <Panel title="Top Tenants by Outstanding" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>View All →</button>}>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property / Unit</th>
                  <th>Outstanding</th>
                  <th>Oldest Debt</th>
                </tr>
              </thead>
              <tbody>
                {topTenants.slice(0, 5).map((t, i) => (
                  <tr key={i}>
                    <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(t.property ?? "—")} · {String(t.unit ?? "—")}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                    <td><Badge tone="red">{kN(t.oldest_days)}d</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
