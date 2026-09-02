"use client";

import { useState, useMemo, type FormEvent } from "react";
import { Box, Button, Chip, MenuItem, TextField, Typography, Checkbox, Paper } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, LeaseRow,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, daysUntil, daysLeftLabel, overdueLabel, pct,
  occupancyTone, shortId, exportCsv, exportLeaseICS, exportICS,
  criticalFormatDate, criticalDaysUntil,
} from "../../utils/property.utils";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Zap, CheckSquare, Layers, AlertCircle, CheckCircle2 } from "lucide-react";
import { BulkLeaseImporter } from "../BulkLeaseImporter";

export function LeasesView({
  rows,
  loading,
  search,
  setSearch,
  setTab,
  onAddLease,
  onAdd,
  onDownloadTemplate = () => {},
  onLeaseAction = () => {},
  onSelectRow = () => {},
  canLease = true,
  onRenew = () => {},
  onTerminate = () => {},
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onAddLease?: () => void;
  onAdd?: () => void;
  onDownloadTemplate?: () => void;
  onLeaseAction?: (r: LeaseRow, action: "activate" | "renew" | "terminate") => void;
  onSelectRow?: (r: Row) => void;
  canLease?: boolean;
  onRenew?: (r: LeaseRow) => void;
  onTerminate?: (r: LeaseRow) => void;
  onRefresh?: () => void;
}) {
  const { session } = useAuth();
  const org = session?.activeOrganizationId ?? null;
  const handleAdd = onAdd || onAddLease || (() => {});

  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Single Lease Edit State
  const [editTarget, setEditTarget] = useState<LeaseRow | null>(null);
  const [editStartsOn, setEditStartsOn] = useState("");
  const [editEndsOn, setEditEndsOn] = useState("");
  const [editMonthlyRent, setEditMonthlyRent] = useState("");
  const [editDeposit, setEditDeposit] = useState("");
  const [editEscalation, setEditEscalation] = useState("");
  const [editInterval, setEditInterval] = useState("12");
  const [editBillingDay, setEditBillingDay] = useState("1");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const openEditModal = (l: LeaseRow) => {
    setEditTarget(l);
    setEditStartsOn(l.starts_on ? String(l.starts_on).slice(0, 10) : "");
    setEditEndsOn(l.ends_on ? String(l.ends_on).slice(0, 10) : "");
    setEditMonthlyRent(String(l.monthly_rent || ""));
    setEditDeposit(String(l.deposit || ""));
    setEditEscalation(String(l.escalation_percent || "0"));
    setEditInterval(String(l.escalation_interval_months || "12"));
    setEditBillingDay(String(l.billing_day || "1"));
    setEditError("");
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget || !org) return;
    setEditBusy(true);
    setEditError("");
    try {
      await apiFetch("/auth/csrf/");
      const payload: Record<string, any> = {
        starts_on: editStartsOn,
        ends_on: editEndsOn,
        monthly_rent: Number(editMonthlyRent || 0),
        deposit: Number(editDeposit || 0),
        escalation_percent: Number(editEscalation || 0),
        escalation_interval_months: Number(editInterval || 12),
        billing_day: Number(editBillingDay || 1),
      };
      const res = await apiFetch(`/property/leases/${editTarget.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }, org);
      if (res.ok) {
        setEditTarget(null);
        onRefresh();
      } else {
        const err = await res.json();
        setEditError(typeof err === "object" ? Object.values(err).flat().join(" ") : "Failed to update lease terms.");
      }
    } catch {
      setEditError("An error occurred while updating the lease.");
    } finally {
      setEditBusy(false);
    }
  };

  // Bulk Edit Form Fields

  const [bulkEscalation, setBulkEscalation] = useState("");
  const [bulkInterval, setBulkInterval] = useState("12");
  const [bulkServiceCharge, setBulkServiceCharge] = useState("");
  const [bulkBillingDay, setBulkBillingDay] = useState("");
  const [bulkActivate, setBulkActivate] = useState(false);

  const PAGE_SIZE = 20;
  const leases = rows as LeaseRow[];
  const filtered = leases.filter((l) => !filterStatus || l.status === filterStatus);
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = leases.filter((l) => l.status === "active").length;
  const expired = leases.filter((l) => l.status === "expired").length;
  const expiring30 = leases.filter((l) => {
    const dl = daysUntil(l.ends_on);
    return dl !== null && dl >= 0 && dl <= 30 && ["active", "expiring"].includes(String(l.status));
  }).length;
  const monthlyRent = leases.filter((l) => ["active", "expiring"].includes(String(l.status))).reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);
  const outstanding = leases.reduce((s, l) => s + Number(l.outstanding ?? 0), 0);
  const statuses = [...new Set(leases.map((l) => l.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  const allPagedSelected = pagedRows.length > 0 && pagedRows.every((l) => selectedIds.includes(String(l.id)));

  const toggleSelectAll = () => {
    if (allPagedSelected) {
      const pagedIdSet = new Set(pagedRows.map((l) => String(l.id)));
      setSelectedIds((prev) => prev.filter((id) => !pagedIdSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...pagedRows.map((l) => String(l.id))]);
      setSelectedIds(Array.from(combined));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  async function handleBulkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org || selectedIds.length === 0) return;
    setBulkBusy(true);
    setBulkNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const payload: Record<string, unknown> = {
        lease_ids: selectedIds,
      };
      if (bulkEscalation.trim()) payload.escalation_percent = bulkEscalation.trim();
      if (bulkInterval.trim()) payload.escalation_interval_months = bulkInterval.trim();
      if (bulkServiceCharge.trim()) payload.service_charge_rate_per_sqft = bulkServiceCharge.trim();
      if (bulkBillingDay.trim()) payload.billing_day = bulkBillingDay.trim();
      if (bulkActivate) payload.status = "active";

      const res = await apiFetch(
        "/properties/leases/bulk-update/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(payload),
        },
        org
      );

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBulkNotice({
          type: "success",
          text: data.message || `Successfully updated ${selectedIds.length} leases!`,
        });
        setTimeout(() => {
          setShowBulkModal(false);
          setBulkNotice(null);
          setSelectedIds([]);
          onRefresh();
        }, 1200);
      } else {
        setBulkNotice({
          type: "error",
          text: data.detail || "Failed to bulk update leases. Please review your inputs.",
        });
      }
    } catch {
      setBulkNotice({ type: "error", text: "Network error occurred during bulk update." });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <KpiStrip>
        <KpiCard icon="📑" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Leases" value={kN(leases.length)} sub="Registered agreements" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Current tenancies" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#d97706" label="Expiring in 30 Days" value={kN(expiring30)} sub="Upcoming renewals" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="🚪" iconBg="#fee2e2" iconColor="#dc2626" label="Expired" value={kN(expired)} sub="Closed agreements" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Rent" value={kM(monthlyRent)} sub="Active leases" link="View rent" onClick={() => setTab("rent")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid lease balances" link="View arrears" onClick={() => setTab("arrears")} />
      </KpiStrip>

      <ViewToolbar title="Lease Register" subtitle="Lease agreements for the selected property" search={search} onSearch={setSearch} placeholder="Search lease no, tenant or unit…">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "reference", label: "Reference" }, { key: "tenant_name", label: "Tenant" },
          { key: "unit_code", label: "Unit" },
          { key: "starts_on", label: "Start" }, { key: "ends_on", label: "End" },
          { key: "monthly_rent", label: "Monthly Rent" }, { key: "deposit", label: "Deposit" },
          { key: "escalation_percent", label: "Escalation %" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" },
        ], "leases.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={() => exportLeaseICS(filtered)} title="Export leases to Outlook/Google Calendar">📅 Export Calendar</button>
      </ViewToolbar>

      <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, border: "1px dashed var(--primary)", background: "var(--surface-2)" }}>
        <div>
          <h4 style={{ margin: "0 0 2px 0", fontSize: 14 }}>Lease Operations & Actions</h4>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            {selectedIds.length > 0
              ? `${selectedIds.length} lease(s) selected for bulk adjustment.`
              : "Select leases with checkboxes to adjust escalation %, service charge rates, or bulk-activate."}
          </p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          {selectedIds.length > 0 && canLease && (
            <button
              className="btn primary sm"
              style={{
                background: "#0284c7",
                color: "#ffffff",
                fontWeight: 800,
                padding: "6px 14px",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
              }}
              onClick={() => setShowBulkModal(true)}
            >
              ⚡ Bulk Edit ({selectedIds.length} Selected)
            </button>
          )}
          <button className="btn primary sm" data-testid="property-add-lease-btn" onClick={handleAdd}>+ Add Lease</button>
          <button className="btn ghost sm" onClick={() => setShowImport(true)}>Import leases</button>
        </div>
      </div>

      <Panel title="Lease Register" action={<button className="btn ghost sm" onClick={() => setTab("rent")}>Invoices →</button>}>
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No leases found" emptyDesc="Add a single lease or bulk import a tenancy schedule to populate the register.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allPagedSelected}
                      onChange={toggleSelectAll}
                      title="Select all on this page"
                    />
                  </th>
                  <th>Lease No</th>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Monthly Rent</th>
                  <th>Escalation %</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Days Left</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((l) => {
                  const isSelected = selectedIds.includes(String(l.id));
                  return (
                    <tr
                      key={String(l.id)}
                      onClick={() => onSelectRow(l)}
                      style={{ background: isSelected ? "rgba(2, 132, 199, 0.05)" : undefined }}
                    >
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(String(l.id))}
                        />
                      </td>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(l.reference ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(l.tenant_name ?? "—")}</strong></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(l.unit_code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(l.starts_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(l.ends_on)}</td>
                      <td className="mono">{kM(l.monthly_rent)}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{l.escalation_percent ? `${l.escalation_percent}%` : "0%"}</td>
                      <td><StatusPill value={String(l.status ?? "—")} /></td>
                      <td className="mono" style={{ color: Number(l.outstanding ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>{l.outstanding === undefined ? "—" : kM(l.outstanding)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{daysLeftLabel(l.ends_on)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); openEditModal(l); }}>Edit</button>
                          {l.status === "draft" && (
                            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "activate"); }}>Activate</button>
                          )}
                          {(["active", "expiring"].includes(String(l.status))) && (
                            <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "renew"); }}>Renew</button>
                          )}
                          {(["active", "expiring"].includes(String(l.status))) && (
                            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "terminate"); }}>Terminate</button>
                          )}
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("rent"); }}>Invoices</button>
                        </div>
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


      {/* Bulk Operations Modal */}
      {showBulkModal && (
        <Modal
          title={`⚡ Bulk Lease Operations (${selectedIds.length} Leases Selected)`}
          onClose={() => setShowBulkModal(false)}
        >
          <form onSubmit={handleBulkSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Specify the values you want to apply across all <strong>{selectedIds.length} selected leases</strong>. Leave any field blank to keep existing values unchanged.
            </p>

            {bulkNotice && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: bulkNotice.type === "success" ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
                  color: bulkNotice.type === "success" ? "#16a34a" : "#dc2626",
                  border: `1px solid ${bulkNotice.type === "success" ? "#86efac" : "#fca5a5"}`,
                  fontSize: 13,
                }}
              >
                {bulkNotice.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{bulkNotice.text}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Annual Escalation %">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 10.00"
                  value={bulkEscalation}
                  onChange={(e) => setBulkEscalation(e.target.value)}
                />
              </Field>

              <Field label="Escalation Frequency">
                <select value={bulkInterval} onChange={(e) => setBulkInterval(e.target.value)}>
                  <option value="12">Annually (Every 12 Months)</option>
                  <option value="24">Biennially (Every 24 Months)</option>
                  <option value="36">Triennially (Every 36 Months)</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Service Charge Rate (KES / sqft)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 25.00"
                  value={bulkServiceCharge}
                  onChange={(e) => setBulkServiceCharge(e.target.value)}
                />
              </Field>

              <Field label="Billing Day of Month">
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 1 (1st of month)"
                  value={bulkBillingDay}
                  onChange={(e) => setBulkBillingDay(e.target.value)}
                />
              </Field>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <input
                type="checkbox"
                id="bulk-activate-checkbox"
                checked={bulkActivate}
                onChange={(e) => setBulkActivate(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <label htmlFor="bulk-activate-checkbox" style={{ fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Bulk Activate Draft Leases (Mark units as occupied & generate rent schedules)
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn ghost sm"
                disabled={bulkBusy}
                onClick={() => setShowBulkModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary sm"
                disabled={bulkBusy}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  fontWeight: 800,
                  padding: "8px 18px",
                }}
              >
                {bulkBusy ? "Applying Changes…" : `Apply to ${selectedIds.length} Leases`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Single Lease Modal */}
      {editTarget && (
        <Modal
          title={`✏️ Edit Lease: ${editTarget.reference || editTarget.id} (${editTarget.tenant_name || "Tenant"} · Unit ${editTarget.unit_code || "—"})`}
          onClose={() => setEditTarget(null)}
          wide
        >
          <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Update the lease start/end dates, monthly rent, security deposit, and escalation terms.
            </p>

            {editError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(220, 38, 38, 0.1)",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                  fontSize: 13,
                }}
              >
                <AlertCircle size={18} />
                <span>{editError}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Lease Start Date (starts_on)" required>
                <input
                  type="date"
                  required
                  value={editStartsOn}
                  onChange={(e) => setEditStartsOn(e.target.value)}
                />
              </Field>

              <Field label="Lease End Date (ends_on)" required>
                <input
                  type="date"
                  required
                  min={editStartsOn}
                  value={editEndsOn}
                  onChange={(e) => setEditEndsOn(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Monthly Contract Rent (KES)" required>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={editMonthlyRent}
                  onChange={(e) => setEditMonthlyRent(e.target.value)}
                />
              </Field>

              <Field label="Security Deposit (KES)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 100000"
                  value={editDeposit}
                  onChange={(e) => setEditDeposit(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="Annual Escalation %">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 10.00"
                  value={editEscalation}
                  onChange={(e) => setEditEscalation(e.target.value)}
                />
              </Field>

              <Field label="Escalation Interval">
                <select value={editInterval} onChange={(e) => setEditInterval(e.target.value)}>
                  <option value="12">Annually (Every 12 Months)</option>
                  <option value="24">Biennially (Every 24 Months)</option>
                  <option value="36">Triennially (Every 36 Months)</option>
                </select>
              </Field>

              <Field label="Billing Day of Month">
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                  value={editBillingDay}
                  onChange={(e) => setEditBillingDay(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setEditTarget(null)}
                disabled={editBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary sm"
                disabled={editBusy}
                style={{ fontWeight: 800 }}
              >
                {editBusy ? "Saving Changes..." : "Save Lease Terms"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <BulkLeaseImporter open={showImport} onClose={() => setShowImport(false)} onDone={onRefresh} />
    </>
  );
}

