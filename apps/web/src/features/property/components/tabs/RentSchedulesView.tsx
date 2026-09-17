"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Checkbox, Chip, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
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
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  {canFinance && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        inputProps={{ "aria-label": "Select all available schedules" } as any}
                        checked={available.length > 0 && selected.length === available.length}
                        onChange={(event) => setSelected(event.target.checked ? available.map((row) => String(row.id)) : [])}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Lease Ref</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Period</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Due</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Base Rent</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Escalation</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Service Charge</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Total</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={String(s.id)} hover selected={selected.includes(String(s.id))}>
                    {canFinance && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          inputProps={{ "aria-label": `Select schedule ${String(s.lease_reference ?? s.id)}` } as any}
                          disabled={Boolean(s.invoice) || s.status === "waived"}
                          checked={selected.includes(String(s.id))}
                          onChange={() => toggleSelected(String(s.id))}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                        {String(s.lease_reference ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(s.tenant_name ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{fmtDate(s.period_start)} — {fmtDate(s.period_end)}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{fmtDate(s.due_on)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(s.base_rent)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{s.escalation_amount ? kM(s.escalation_amount) : "—"}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{s.service_charge ? kM(s.service_charge) : "—"}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>
                        {kM(s.total)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><StatusPill value={String(s.status ?? "—")} /></TableCell>
                    <TableCell align="right">
                      {!s.invoice && s.status !== "waived" && canFinance ? (
                        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} disabled={busy} onClick={() => void previewSchedule(s)}>
                          Preview
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          {s.invoice ? "Invoiced" : s.status === "waived" ? "Waived" : "View only"}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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

