"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Box, Button, Chip, MenuItem, TextField, Typography } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, PropertyRow, BuildingRow, UnitRow, ProjectRow,
  TenantRow, TenantDocumentRow, LeaseRow, RentScheduleRow, InvoiceRow,
  InvoicePreview, ReceiptRow, ReminderRow, BankTransactionRow, ExpenseRow,
  BudgetRow, ServiceChargeRow, ServiceChargeAllocationRow,
  ServiceChargeReconciliationRow, ReceiptAllocationRow, CreditNoteRow,
  AgingTenantRow, AgingAnalytics, FinancialAnalytics, ReportItem,
  DashboardData, RentSection, ScSection, TenancySection, FinancialsSection,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, daysUntil, daysLeftLabel, overdueLabel, pct,
  occupancyTone, shortId, exportCsv, exportLeaseICS,
} from "../../utils/property.utils";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

export function RentSchedulesView({ rows, loading, search, setSearch, onGenerateInvoice, onRefresh, canFinance }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onGenerateInvoice: (r: RentScheduleRow, taxRate?: number) => void; onRefresh: () => void; canFinance: boolean;
}) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const schedules = rows as RentScheduleRow[];
  const [selected, setSelected] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState("0");
  const [preview, setPreview] = useState<(InvoicePreview & { schedule: ID; base_rent?: number; escalation_amount?: number; service_charge?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const available = schedules.filter((schedule) => !schedule.invoice && schedule.status !== "waived");
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function previewSchedule(schedule: RentScheduleRow) {
    if (!organizationId) return;
    setBusy(true);
    const response = await apiFetch(`/property/rent-schedules/${schedule.id}/preview/`, {
      method: "POST", body: JSON.stringify({ tax_rate: Number(taxRate) }),
    }, organizationId);
    if (response.ok) setPreview(await response.json());
    setBusy(false);
  }

  async function bulkCreateDrafts() {
    if (!organizationId || selected.length === 0) return;
    setBusy(true);
    const response = await apiFetch("/property/rent-schedules/bulk-generate-invoices/", {
      method: "POST", body: JSON.stringify({ schedule_ids: selected, tax_rate: Number(taxRate) }),
    }, organizationId);
    if (response.ok) {
      setSelected([]);
      setPreview(null);
      onRefresh();
    }
    setBusy(false);
  }

  return (
    <>
      <ViewToolbar title="Rent Roll" subtitle="Unit-by-unit rent schedule with escalation and service charge" search={search} onSearch={setSearch} placeholder="Search by lease reference or tenant…" />

      <Panel title="Rent Schedule (Rent Roll)" action={canFinance ? <div className="row" style={{ gap: 8 }}>
        <label className="row" style={{ gap: 6, fontSize: 12 }}><span className="muted">VAT</span><select aria-label="Rent schedule VAT" value={taxRate} onChange={(event) => { setTaxRate(event.target.value); setPreview(null); }} style={{ width: 110 }}><option value="0">0%</option><option value="16">16%</option></select></label>
        <button className="btn primary sm" disabled={selected.length === 0 || busy} onClick={() => void bulkCreateDrafts()} data-testid="bulk-invoice-drafts">Create {selected.length || "selected"} draft{selected.length === 1 ? "" : "s"}</button>
      </div> : undefined}>
        <ListState loading={loading} empty={schedules.length === 0} emptyTitle="No rent schedules found" emptyDesc="Generate rent schedules from active leases to build the rent roll.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  {canFinance && <th><input type="checkbox" aria-label="Select all available schedules" checked={available.length > 0 && selected.length === available.length} onChange={(event) => setSelected(event.target.checked ? available.map((row) => String(row.id)) : [])} /></th>}
                  <th>Lease Ref</th>
                  <th>Tenant</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th>Base Rent</th>
                  <th>Escalation</th>
                  <th>Service Charge</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={String(s.id)}>
                    {canFinance && <td><input type="checkbox" aria-label={`Select schedule ${String(s.lease_reference ?? s.id)}`} disabled={Boolean(s.invoice) || s.status === "waived"} checked={selected.includes(String(s.id))} onChange={() => toggleSelected(String(s.id))} /></td>}
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(s.lease_reference ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(s.tenant_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(s.period_start)} — {fmtDate(s.period_end)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(s.due_on)}</td>
                    <td className="mono">{kM(s.base_rent)}</td>
                    <td className="mono">{s.escalation_amount ? kM(s.escalation_amount) : "—"}</td>
                    <td className="mono">{s.service_charge ? kM(s.service_charge) : "—"}</td>
                    <td className="mono"><strong>{kM(s.total)}</strong></td>
                    <td><StatusPill value={String(s.status ?? "—")} /></td>
                    <td>{!s.invoice && s.status !== "waived" && canFinance ? <button className="btn ghost sm" disabled={busy} onClick={() => void previewSchedule(s)}>Preview</button> : <span className="muted">{s.invoice ? "Invoiced" : s.status === "waived" ? "Waived" : "View only"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
      {preview && (
        <Modal title="Review scheduled rent invoice" onClose={() => setPreview(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="schedule-invoice-preview">
            <div><strong>{preview.tenant}</strong><p className="muted" style={{ margin: "3px 0 0" }}>{String(preview.lease)} · scheduled rent breakdown</p></div>
            <div className="grid-2">
              <div><span className="muted">Base rent</span><div className="mono">{kM(preview.base_rent)}</div></div>
              <div><span className="muted">Escalation</span><div className="mono">{kM(preview.escalation_amount)}</div></div>
              <div><span className="muted">Service charge</span><div className="mono">{kM(preview.service_charge)}</div></div>
              <div><span className="muted">Subtotal</span><div className="mono">{kM(preview.subtotal)}</div></div>
              <div><span className="muted">VAT ({preview.tax_rate}%)</span><div className="mono">{kM(preview.tax_amount)}</div></div>
              <div><span className="muted">Draft total</span><div className="mono"><strong>{kM(preview.total)}</strong></div></div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Confirming creates a draft only. It must still be submitted, approved and issued.</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}><button className="btn ghost" onClick={() => setPreview(null)}>Cancel</button><button className="btn primary" onClick={() => { const schedule = schedules.find((row) => String(row.id) === String(preview.schedule)); if (schedule) onGenerateInvoice(schedule, Number(taxRate)); setPreview(null); }}>Create draft</button></div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─── RENT & INVOICES ─── */

