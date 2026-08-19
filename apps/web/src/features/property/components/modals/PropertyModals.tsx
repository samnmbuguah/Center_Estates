"use client";

import { FormEvent, type ReactNode } from "react";
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
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { kM, kN, fmtDate } from "../../utils/property.utils";
import { TenantApplicationCard } from "@/components/tenant-application-card";
import { useState } from "react";

function EditTenantForm({ tenant, onSave, onCancel }: { tenant: TenantRow; onSave: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: String(tenant.name ?? ""),
    email: String(tenant.email ?? ""),
    phone: String(tenant.phone ?? ""),
    tenant_type: String(tenant.tenant_type ?? "company"),
    tax_id: String(tenant.tax_id ?? ""),
    registration_number: String(tenant.registration_number ?? ""),
    billing_address: String(tenant.billing_address ?? ""),
  });
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid-2">
        <Field label="Tenant Name" required><input value={form.name} onChange={set("name")} required data-testid="edit-tenant-name" /></Field>
        <Field label="Tenant Type">
          <select value={form.tenant_type} onChange={set("tenant_type")}>
            <option value="company">Company</option>
            <option value="individual">Individual</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Email"><input type="email" value={form.email} onChange={set("email")} data-testid="edit-tenant-email" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set("phone")} data-testid="edit-tenant-phone" /></Field>
      </div>
      <div className="grid-2">
        <Field label="KRA PIN / Tax ID"><input value={form.tax_id} onChange={set("tax_id")} placeholder="e.g. P051234567X" /></Field>
        <Field label="Registration No."><input value={form.registration_number} onChange={set("registration_number")} /></Field>
      </div>
      <Field label="Billing Address"><textarea rows={2} value={form.billing_address} onChange={set("billing_address")} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} /></Field>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" data-testid="edit-tenant-save">Save Changes</button>
      </div>
    </form>
  );
}

function VoidCreditNoteForm({ creditNote, onConfirm, onCancel }: { creditNote: CreditNoteRow; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onConfirm(reason); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{creditNote.number ?? "—"}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Tenant: {creditNote.tenant_name ?? "—"} · Amount: {creditNote.amount}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Invoice: {creditNote.invoice_number ?? "—"}</div>
      </div>
      <Field label="Reason for voiding (required)">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Explain why this credit note is being voided…" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", fontFamily: "inherit" }} data-testid="void-cn-reason" />
      </Field>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!reason.trim()} style={{ background: "var(--danger)" }} data-testid="void-cn-confirm">Void Credit Note</button>
      </div>
    </form>
  );
}

export interface PropertyModalsProps {
  showAddProperty: boolean;
  setShowAddProperty: (v: boolean) => void;
  showAddTenant: boolean;
  setShowAddTenant: (v: boolean) => void;
  showEditTenant: boolean;
  setShowEditTenant: (v: boolean) => void;
  editTenant: TenantRow | null;
  setEditTenant: (v: TenantRow | null) => void;
  submitEditTenant: (data: Record<string, unknown>) => void;
  voidCreditNoteTarget: CreditNoteRow | null;
  setVoidCreditNoteTarget: (v: CreditNoteRow | null) => void;
  submitVoidCreditNote: (reason: string) => void;
  showAddLease: boolean;
  setShowAddLease: (v: boolean) => void;
  showRecordReceipt: boolean;
  setShowRecordReceipt: (v: boolean) => void;
  showInvoiceComposer: boolean;
  setShowInvoiceComposer: (v: boolean) => void;
  showUploadDoc: boolean;
  setShowUploadDoc: (v: boolean) => void;
  showAddServiceCharge: boolean;
  setShowAddServiceCharge: (v: boolean) => void;
  financialIntake: "budget" | "expense" | "credit-note" | null;
  setFinancialIntake: (v: "budget" | "expense" | "credit-note" | null) => void;
  matchTarget: BankTransactionRow | null;
  setMatchTarget: (v: BankTransactionRow | null) => void;
  renewalTarget: LeaseRow | null;
  setRenewalTarget: (v: LeaseRow | null) => void;
  terminationTarget: LeaseRow | null;
  setTerminationTarget: (v: LeaseRow | null) => void;
  reconciliationTarget: ServiceChargeRow | null;
  setReconciliationTarget: (v: ServiceChargeRow | null) => void;
  documentRejectTarget: TenantDocumentRow | null;
  setDocumentRejectTarget: (v: TenantDocumentRow | null) => void;
  confirmVoidInvoice: InvoiceRow | null;
  setConfirmVoidInvoice: (v: InvoiceRow | null) => void;
  confirmRejectBudget: BudgetRow | null;
  setConfirmRejectBudget: (v: BudgetRow | null) => void;
  receiptInvoice: ID;
  setReceiptInvoice: (v: ID) => void;
  wizardStep: number;
  setWizardStep: (v: number) => void;
  propertyData: Record<string, string>;
  setPropertyData: (v: Record<string, string> | ((p: Record<string, string>) => Record<string, string>)) => void;
  unitMix: { type: string; count: number; size: number }[];
  setUnitMix: (v: any) => void;
  tenantOptions: Row[];
  unitOptions: Row[];
  invoiceOptions: Row[];
  receiptOptions: Row[];
  propertyOptions: Row[];
  leaseOptions: LeaseRow[];
  invoicePreview: InvoicePreview | null;
  setInvoicePreview: (v: InvoicePreview | null) => void;
  invoiceDraft: { number: string; lease: string; invoice_type: string; issued_on: string; due_on: string; subtotal: string; tax_rate: string };
  setInvoiceDraft: (v: any) => void;
  onAddPropertySubmit: (e?: any) => any;
  onAddTenantSubmit: (e?: any) => any;
  onAddLeaseSubmit: (e?: any) => any;
  onRecordReceiptSubmit: (e?: any) => any;
  onComposeInvoiceSubmit: (e?: any) => any;
  onUploadDocSubmit: (e?: any) => any;
  onAddServiceChargeSubmit: (e?: any) => any;
  onFinancialIntakeSubmit: (e?: any) => any;
  onMatchSubmit: (e?: any) => any;
  onRenewLeaseSubmit: (e?: any) => any;
  onTerminateLeaseSubmit: (e?: any) => any;
  onReconcileSubmit: (e?: any) => any;
  onRejectDocumentSubmit: (e?: any) => any;
  onVoidInvoiceConfirm: () => any;
  onRejectBudgetConfirm: () => any;
  onInvoiceLeaseChange: (leaseId: string) => any;
  canOperate: boolean;
  canLease: boolean;
  canFinance: boolean;
  canApprove: boolean;
  activeProperty: { id: string; name: string } | null;
  setTab: (t: PropertyTab) => void;
  standaloneOnboarding?: boolean;
  fetchData?: () => void;
  previewInvoice?: () => void;
}

export function PropertyModals(props: PropertyModalsProps) {
  const {
    showAddProperty, setShowAddProperty,
    showAddTenant, setShowAddTenant,
    showEditTenant, setShowEditTenant, editTenant, setEditTenant, submitEditTenant,
    voidCreditNoteTarget, setVoidCreditNoteTarget, submitVoidCreditNote,
    showAddLease, setShowAddLease,
    showRecordReceipt, setShowRecordReceipt,
    showInvoiceComposer, setShowInvoiceComposer,
    showUploadDoc, setShowUploadDoc,
    showAddServiceCharge, setShowAddServiceCharge,
    financialIntake, setFinancialIntake,
    matchTarget, setMatchTarget,
    renewalTarget, setRenewalTarget,
    terminationTarget, setTerminationTarget,
    reconciliationTarget, setReconciliationTarget,
    documentRejectTarget, setDocumentRejectTarget,
    confirmVoidInvoice, setConfirmVoidInvoice,
    confirmRejectBudget, setConfirmRejectBudget,
    receiptInvoice, setReceiptInvoice,
    wizardStep, setWizardStep,
    propertyData, setPropertyData,
    unitMix, setUnitMix,
    tenantOptions, unitOptions, invoiceOptions, receiptOptions, propertyOptions, leaseOptions,
    invoicePreview, setInvoicePreview,
    invoiceDraft, setInvoiceDraft,
    onAddPropertySubmit, onAddTenantSubmit, onAddLeaseSubmit, onRecordReceiptSubmit,
    onComposeInvoiceSubmit, onUploadDocSubmit, onAddServiceChargeSubmit, onFinancialIntakeSubmit,
    onMatchSubmit, onRenewLeaseSubmit, onTerminateLeaseSubmit, onReconcileSubmit,
    onRejectDocumentSubmit, onVoidInvoiceConfirm, onRejectBudgetConfirm, onInvoiceLeaseChange,
    canOperate, canLease, canFinance, canApprove, activeProperty, setTab,
    standaloneOnboarding = false,
    fetchData = () => {},
    previewInvoice = () => {},
  } = props;

  const submitAddProperty = (e?: any) => onAddPropertySubmit(e ?? { preventDefault: () => {} } as any);
  const submitAddLease = onAddLeaseSubmit;
  const submitUploadDoc = onUploadDocSubmit;
  const submitRecordReceipt = onRecordReceiptSubmit;
  const submitInvoiceDraft = onComposeInvoiceSubmit;
  const submitServiceCharge = onAddServiceChargeSubmit;
  const submitFinancialIntake = onFinancialIntakeSubmit;
  const submitLeaseRenewal = onRenewLeaseSubmit;
  const submitServiceChargeReconciliation = onReconcileSubmit;
  const submitDocumentRejection = onRejectDocumentSubmit;
  const submitBankMatch = onMatchSubmit;
  const loadData = fetchData;
  const updateInvoiceDraft = (key: string, value: string) => {
    if (key === "lease") {
      onInvoiceLeaseChange(value);
    } else {
      setInvoiceDraft((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  return (
    <>
        {showAddProperty && (
          standaloneOnboarding ? (
            <section className="property-onboarding-page" aria-labelledby="property-onboarding-title">
              <header className="page-head" style={{ marginBottom: 20 }}>
                <div><p className="eyebrow">Property setup</p><h1 id="property-onboarding-title">Property onboarding</h1><p className="muted">Create the property and its initial unit mix in one place. Property codes are generated automatically.</p></div>
              </header>
              <div className="card" style={{ padding: 24 }}>
                <div className="grid-2" style={{ gap: 16 }}>
                  <Field label="Property name" required><input required data-testid="prop-name-input" value={propertyData.name ?? ""} onChange={(e) => setPropertyData({ ...propertyData, name: e.target.value })} placeholder="e.g. Palm Court Apartments" /></Field>
                  <Field label="Property type" required><select data-testid="prop-type-select" value={propertyData.type ?? "commercial"} onChange={(e) => setPropertyData({ ...propertyData, type: e.target.value })}><option value="commercial">Commercial</option><option value="residential">Residential</option><option value="mixed_use">Mixed use</option><option value="industrial">Industrial</option></select></Field>
                  <Field label="City / town" required><input required data-testid="prop-city-input" value={propertyData.city ?? ""} onChange={(e) => setPropertyData({ ...propertyData, city: e.target.value })} placeholder="e.g. Mombasa" /></Field>
                  <Field label="Country"><input value={propertyData.country ?? "KE"} onChange={(e) => setPropertyData({ ...propertyData, country: e.target.value })} /></Field>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Physical address"><textarea rows={3} value={propertyData.address ?? ""} onChange={(e) => setPropertyData({ ...propertyData, address: e.target.value })} placeholder="Street, estate or landmark" /></Field></div>
                </div>
                <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "24px 0" }} />
                <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Initial unit mix</h2><p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Optional. Add unit types now, or create units later from Property Management.</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {unitMix.map((u, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 110px 130px auto", gap: 10, alignItems: "end" }}>
                    <Field label="Unit type"><input value={u.type} onChange={(e) => { const next = [...unitMix]; next[i] = { ...u, type: e.target.value }; setUnitMix(next); }} placeholder="e.g. Two bedroom" /></Field>
                    <Field label="Quantity"><input type="number" min={1} value={u.count} onChange={(e) => { const next = [...unitMix]; next[i] = { ...u, count: Number(e.target.value) }; setUnitMix(next); }} /></Field>
                    <Field label="Avg. size (sq ft)"><input type="number" min={0} value={u.size || ""} onChange={(e) => { const next = [...unitMix]; next[i] = { ...u, size: Number(e.target.value) }; setUnitMix(next); }} /></Field>
                    <button type="button" className="btn ghost sm" onClick={() => setUnitMix(unitMix.filter((_, index) => index !== i))} disabled={unitMix.length === 1}>Remove</button>
                  </div>)}
                </div>
                <button type="button" className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setUnitMix([...unitMix, { type: "", count: 1, size: 0 }])}>+ Add unit type</button>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 24 }}><button type="button" className="btn ghost" onClick={() => window.location.assign("/workspaces")}>Cancel</button><button type="button" className="btn primary" data-testid="prop-wizard-create" disabled={!propertyData.name?.trim() || !propertyData.city?.trim()} onClick={(e) => onAddPropertySubmit(e as any)}>Create property</button></div>
              </div>
            </section>
          ) : <Modal title="Add New Property" onClose={() => { setShowAddProperty(false); setWizardStep(1); setPropertyData({}); setUnitMix([{ type: "", count: 1, size: 0 }]); }} wide>
            {wizardStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 1 of 3 — Basic Information</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Property Name" required>
                    <input name="name" required data-testid="prop-name-input" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.name ?? ""} onChange={(e) => setPropertyData({ ...propertyData, name: e.target.value })} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Type" required>
                    <select name="type" data-testid="prop-type-select" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.type ?? "commercial"} onChange={(e) => setPropertyData({ ...propertyData, type: e.target.value })}>
                      <option value="commercial">Commercial</option>
                      <option value="residential">Residential</option>
                      <option value="mixed_use">Mixed Use</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </Field>
                  <Field label="City" required>
                    <input name="city" required data-testid="prop-city-input" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.city ?? ""} onChange={(e) => setPropertyData({ ...propertyData, city: e.target.value })} />
                  </Field>
                </div>
                <Field label="Address">
                  <input name="address" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.address ?? ""} onChange={(e) => setPropertyData({ ...propertyData, address: e.target.value })} />
                </Field>
                <Field label="Country">
                  <input name="country" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.country ?? "KE"} onChange={(e) => setPropertyData({ ...propertyData, country: e.target.value })} />
                </Field>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => { setShowAddProperty(false); setWizardStep(1); }}>Cancel</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-next" onClick={() => setWizardStep(2)}>Next →</button>
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 2 of 3 — Unit Mix</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Define the unit types for this property.</p>
                {unitMix.map((u, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                    <Field label="Unit Type">
                      <input value={u.type} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], type: e.target.value }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <Field label="Count">
                      <input type="number" min={1} value={u.count} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], count: Number(e.target.value) }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <Field label="Avg Size (sqft)">
                      <input type="number" min={0} value={u.size || ""} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], size: Number(e.target.value) }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <button type="button" className="btn ghost sm" style={{ marginBottom: 2 }} onClick={() => setUnitMix(unitMix.filter((_, j) => j !== i))} disabled={unitMix.length <= 1}>×</button>
                  </div>
                ))}
                <button type="button" className="btn ghost sm" onClick={() => setUnitMix([...unitMix, { type: "", count: 1, size: 0 }])}>+ Add Unit Type</button>
                <div className="muted" style={{ fontSize: 12 }}>Total Units: {unitMix.reduce((s, u) => s + u.count, 0)} · Total Area: {unitMix.reduce((s, u) => s + u.count * u.size, 0).toLocaleString()} sqft</div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setWizardStep(1)}>← Back</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-next" onClick={() => setWizardStep(3)}>Next →</button>
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 3 of 3 — Review & Save</p>
                <h4 style={{ margin: 0, fontSize: 14 }}>Review Property</h4>
                <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Name", value: propertyData.name },
                      { label: "Type", value: propertyData.type },
                      { label: "City", value: propertyData.city },
                      { label: "Address", value: propertyData.address },
                      { label: "Country", value: propertyData.country },
                    ].map((f) => (
                      <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span className="muted" style={{ fontSize: 11 }}>{f.label}</span>
                        <strong style={{ fontSize: 13 }}>{f.value || "—"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <h4 style={{ margin: "4px 0 0", fontSize: 14 }}>Unit Mix</h4>
                <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                  {unitMix.filter((u) => u.type.trim()).length > 0 ? (
                    <table className="fc-data-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Unit Type</th>
                          <th>Count</th>
                          <th>Avg Size</th>
                          <th>Total Area</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitMix.filter((u) => u.type.trim()).map((u, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 12 }}>{u.type}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.count}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.size ? `${u.size.toLocaleString()} sqft` : "—"}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.size ? `${(u.count * u.size).toLocaleString()} sqft` : "—"}</td>
                          </tr>
                        ))}
                        <tr>
                          <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                          <td className="mono"><strong>{unitMix.reduce((s, u) => s + u.count, 0)}</strong></td>
                          <td />
                          <td className="mono"><strong>{unitMix.reduce((s, u) => s + u.count * u.size, 0).toLocaleString()} sqft</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>No unit types defined.</p>
                  )}
                </div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setWizardStep(2)}>← Back</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-create" onClick={() => void submitAddProperty()}>Create Property</button>
                </div>
              </div>
            )}
          </Modal>
        )}

        <TenantApplicationCard
          open={showAddTenant}
          onClose={() => setShowAddTenant(false)}
          onSaved={() => { setShowAddTenant(false); setTab("tenants"); loadData(); }}
        />

        {showEditTenant && editTenant && (
          <Modal title={`Edit Tenant: ${editTenant.name ?? ""}`} onClose={() => { setShowEditTenant(false); setEditTenant(null); }}>
            <EditTenantForm tenant={editTenant} onSave={(data) => { void submitEditTenant(data); }} onCancel={() => { setShowEditTenant(false); setEditTenant(null); }} />
          </Modal>
        )}

        {voidCreditNoteTarget && (
          <Modal title="Void Credit Note" onClose={() => setVoidCreditNoteTarget(null)}>
            <VoidCreditNoteForm creditNote={voidCreditNoteTarget} onConfirm={(reason) => { void submitVoidCreditNote(reason); }} onCancel={() => setVoidCreditNoteTarget(null)} />
          </Modal>
        )}

        {showAddLease && (
          <Modal title="Add Single Lease" onClose={() => setShowAddLease(false)} wide>
            <form onSubmit={submitAddLease} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Lease Reference" required>
                  <input name="reference" required placeholder="e.g. LSE-2026-0001" data-testid="lease-ref-input" />
                </Field>
                <Field label="Billing Day">
                  <input name="billing_day" type="number" min={1} max={28} defaultValue={1} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Tenant" required>
                  <select name="tenant" required defaultValue="" data-testid="lease-tenant-select">
                    <option value="" disabled>Select tenant</option>
                    {tenantOptions.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit" required>
                  <select name="unit" required defaultValue="" data-testid="lease-unit-select">
                    <option value="" disabled>Select unit</option>
                    {unitOptions.map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>{String(u.code)} · {String(u.property_name ?? "")}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Start Date" required>
                  <input name="starts_on" type="date" required data-testid="lease-start-input" />
                </Field>
                <Field label="End Date" required>
                  <input name="ends_on" type="date" required data-testid="lease-end-input" />
                </Field>
              </div>
              <div className="grid-3">
                <Field label="Monthly Rent (KES)" required>
                  <input name="monthly_rent" type="number" min={1} required data-testid="lease-rent-input" />
                </Field>
                <Field label="Deposit (KES)">
                  <input name="deposit" type="number" min={0} defaultValue={0} data-testid="lease-deposit-input" />
                </Field>
                <Field label="Escalation %">
                  <input name="escalation_percent" type="number" min={0} defaultValue={0} />
                </Field>
                <Field label="Escalation frequency">
                  <select name="escalation_interval_months" defaultValue="12"><option value="12">Annually</option><option value="24">Biennially</option><option value="36">Triennially</option></select>
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddLease(false)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="lease-save-btn">Save Lease</button>
              </div>
            </form>
          </Modal>
        )}

        {showUploadDoc && (
          <Modal title="Upload Tenant Document" onClose={() => setShowUploadDoc(false)} wide>
            <form onSubmit={submitUploadDoc} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Tenant" required>
                  <select name="tenant" required defaultValue="">
                    <option value="" disabled>Select tenant</option>
                    {tenantOptions.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Document Type" required>
                  <select name="document_type" required defaultValue="">
                    <option value="" disabled>Select type</option>
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="kra_pin">KRA PIN</option>
                    <option value="business_registration">Business Registration</option>
                    <option value="lease_agreement">Lease Agreement</option>
                    <option value="guarantee">Guarantee</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Document Number">
                  <input name="document_number" placeholder="Reference on the document" />
                </Field>
                <Field label="File URL (Optional)">
                  <input name="file_url" placeholder="https://… or /media/documents/… (optional)" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Issued On">
                  <input name="issued_on" type="date" />
                </Field>
                <Field label="Expires On">
                  <input name="expires_on" type="date" />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowUploadDoc(false)}>Cancel</button>
                <button type="submit" className="btn primary">Upload Document</button>
              </div>
            </form>
          </Modal>
        )}

        {showRecordReceipt && (
          <Modal title="Record Rent Payment Receipt" onClose={() => setShowRecordReceipt(false)} wide>
            <form onSubmit={submitRecordReceipt} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Receipt Number" required>
                  <input name="number" required placeholder="e.g. RCPT-2026-0001" />
                </Field>
                <Field label="Received On" required>
                  <input name="received_on" type="date" required />
                </Field>
              </div>
              <Field label="Tenant" required>
                <select name="tenant" required defaultValue="">
                  <option value="" disabled>Select tenant</option>
                  {tenantOptions.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid-2">
                <Field label="Amount (KES)" required>
                  <input name="amount" type="number" min={1} required placeholder="0" data-testid="receipt-amount-input" />
                </Field>
                <Field label="Payment Method">
                  <select name="payment_method" defaultValue="bank_transfer">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mpesa">M-Pesa Paybill</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </Field>
              </div>
              <Field label="Allocate to Invoice (optional)">
                <select name="invoice" defaultValue={receiptInvoice}>
                  <option value="">Unallocated</option>
                  {invoiceOptions.map((inv) => (
                    <option key={String(inv.id)} value={String(inv.id)}>{String(inv.number)} · {kM(inv.amount)}</option>
                  ))}
                </select>
              </Field>
              <Field label="External Reference">
                <input name="external_reference" placeholder="Bank ref / M-Pesa code" />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowRecordReceipt(false)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="receipt-save-btn">Post Receipt</button>
              </div>
            </form>
          </Modal>
        )}

        {showInvoiceComposer && (
          <Modal title="Create invoice draft" onClose={() => { setShowInvoiceComposer(false); setInvoicePreview(null); }} wide>
            <form onSubmit={submitInvoiceDraft} style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="invoice-composer">
              <div className="grid-2">
                <Field label="Invoice number">
                  <input readOnly value="Auto-generated on save" aria-label="Invoice number is generated automatically" />
                </Field>
                <Field label="Lease" required>
                  <select required value={invoiceDraft.lease} onChange={(e) => updateInvoiceDraft("lease", e.target.value)} data-testid="invoice-lease">
                    <option value="" disabled>Select active lease</option>
                    {leaseOptions.map((lease) => <option key={String(lease.id)} value={String(lease.id)}>{String(lease.reference)} · {String(lease.tenant_name)} · {String(lease.unit_code)}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Invoice type" required>
                  <select value={invoiceDraft.invoice_type} onChange={(e) => updateInvoiceDraft("invoice_type", e.target.value)}>
                    <option value="rent">Rent</option><option value="move_in">Move-in charges</option>
                    <option value="service_charge">Service charge</option><option value="utility">Utility</option><option value="other">Other</option>
                  </select>
                </Field>
                <Field label="VAT" required>
                  <select value={invoiceDraft.tax_rate} onChange={(e) => updateInvoiceDraft("tax_rate", e.target.value)} data-testid="invoice-vat">
                    <option value="0">No VAT (0%)</option><option value="16">VAT (16%)</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Issue date" required><input type="date" required value={invoiceDraft.issued_on} onChange={(e) => updateInvoiceDraft("issued_on", e.target.value)} /></Field>
                <Field label="Due date" required><input type="date" required min={invoiceDraft.issued_on} value={invoiceDraft.due_on} onChange={(e) => updateInvoiceDraft("due_on", e.target.value)} /></Field>
              </div>
              <Field label="Subtotal before VAT" required>
                <input type="number" min="0.01" step="0.01" required value={invoiceDraft.subtotal} onChange={(e) => updateInvoiceDraft("subtotal", e.target.value)} data-testid="invoice-subtotal" />
              </Field>
              {invoicePreview && (
                <section className="card" style={{ padding: 14, background: "var(--surface-2)" }} aria-live="polite" data-testid="invoice-preview">
                  <strong>{invoicePreview.tenant} · {invoicePreview.property} · Unit {invoicePreview.unit}</strong>
                  <div className="grid-3" style={{ marginTop: 10 }}>
                    <div><span className="muted">Subtotal</span><div className="mono">{kM(invoicePreview.subtotal)}</div></div>
                    <div><span className="muted">VAT ({invoicePreview.tax_rate}%)</span><div className="mono">{kM(invoicePreview.tax_amount)}</div></div>
                    <div><span className="muted">Invoice total</span><div className="mono"><strong>{kM(invoicePreview.total)}</strong></div></div>
                  </div>
                </section>
              )}
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>The invoice is saved as a draft. A finance user submits it for independent approval before it can be issued and sent to the tenant.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => { setShowInvoiceComposer(false); setInvoicePreview(null); }}>Cancel</button>
                <button type="button" className="btn ghost" onClick={() => void previewInvoice()} data-testid="invoice-preview-btn">Preview invoice</button>
                <button type="submit" className="btn primary" disabled={!invoicePreview} data-testid="invoice-save-draft">Save reviewable draft</button>
              </div>
            </form>
          </Modal>
        )}

        {showAddServiceCharge && (
          <Modal title="Set up service charge" onClose={() => setShowAddServiceCharge(false)} wide>
            <form onSubmit={submitServiceCharge} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Property" required>
                <select name="property" required defaultValue="">
                  <option value="" disabled>Select property</option>
                  {propertyOptions.map((property) => (
                    <option key={String(property.id)} value={String(property.id)}>{String(property.name ?? property.code)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid-2">
                <Field label="Scheme name" required>
                  <input name="name" required placeholder="e.g. 2026 Commercial Service Charge" />
                </Field>
                <Field label="Allocation method" required>
                  <select name="method" defaultValue="area">
                    <option value="area">Floor area</option>
                    <option value="equal">Equal share</option>
                    <option value="fixed">Fixed allocation</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Starts on" required>
                  <input name="starts_on" type="date" required />
                </Field>
                <Field label="Annual service budget" required>
                  <input name="annual_budget" type="number" min={1} step="0.01" required />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddServiceCharge(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save draft</button>
              </div>
            </form>
          </Modal>
        )}

        {financialIntake && (
          <Modal
            title={financialIntake === "credit-note" ? "Issue credit note" : financialIntake === "expense" ? "Record supplier expense" : "Create budget line"}
            onClose={() => setFinancialIntake(null)}
            wide
          >
            <form onSubmit={submitFinancialIntake} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {financialIntake === "credit-note" ? (
                <>
                  <div className="grid-2">
                    <Field label="Credit note number" required><input name="number" required placeholder="e.g. CN-2026-0001" /></Field>
                    <Field label="Issued on" required><input name="issued_on" type="date" required /></Field>
                  </div>
                  <Field label="Invoice" required>
                    <select name="invoice" required defaultValue="">
                      <option value="" disabled>Select outstanding invoice</option>
                      {invoiceOptions.map((invoice) => (
                        <option key={String(invoice.id)} value={String(invoice.id)}>{String(invoice.number)} · {String(invoice.tenant_name ?? "")} · {kM(invoice.balance)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Credit amount" required><input name="amount" type="number" min={0.01} step="0.01" required /></Field>
                  <Field label="Reason" required><textarea name="reason" rows={3} required placeholder="Reason for the adjustment" /></Field>
                </>
              ) : (
                <>
                  <Field label="Property" required>
                    <select name="property" required defaultValue="">
                      <option value="" disabled>Select property</option>
                      {propertyOptions.map((property) => (
                        <option key={String(property.id)} value={String(property.id)}>{String(property.code ?? "")} · {String(property.name ?? "")}</option>
                      ))}
                    </select>
                  </Field>
                  {financialIntake === "expense" ? (
                    <>
                      <div className="grid-2">
                        <Field label="Supplier" required><input name="supplier" required /></Field>
                        <Field label="Supplier invoice"><input name="invoice_number" /></Field>
                      </div>
                      <div className="grid-2">
                        <Field label="Category" required><input name="category" required placeholder="Utilities" /></Field>
                        <Field label="Incurred on" required><input name="incurred_on" type="date" required /></Field>
                      </div>
                      <Field label="Description"><textarea name="description" rows={3} /></Field>
                    </>
                  ) : (
                    <div className="grid-2">
                      <Field label="Budget year" required><input name="year" type="number" min={2020} max={2100} defaultValue={new Date().getFullYear()} required /></Field>
                      <Field label="Category" required><input name="category" required placeholder="Repairs and maintenance" /></Field>
                    </div>
                  )}
                  <Field label={financialIntake === "expense" ? "Expense amount" : "Annual budget"} required>
                    <input name="amount" type="number" min={financialIntake === "expense" ? 0.01 : 0} step="0.01" required />
                  </Field>
                </>
              )}
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                {financialIntake === "credit-note" ? "Issuing this note immediately adjusts the selected invoice balance and creates an immutable audit record." : "The record starts in draft and follows the controlled submit and approval workflow."}
              </p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setFinancialIntake(null)}>Cancel</button>
                <button type="submit" className="btn primary">{financialIntake === "credit-note" ? "Issue credit note" : "Save draft"}</button>
              </div>
            </form>
          </Modal>
        )}

        {renewalTarget && (
          <Modal title="Renew lease" onClose={() => setRenewalTarget(null)}>
            <form onSubmit={submitLeaseRenewal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <strong>{String(renewalTarget.reference ?? "Lease")}</strong>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{String(renewalTarget.tenant_name ?? "")} · current end {fmtDate(renewalTarget.ends_on)}</p>
              </div>
              <Field label="Renewal reference" required><input name="reference" required placeholder={`${String(renewalTarget.reference ?? "LEASE")}-R1`} /></Field>
              <div className="grid-2">
                <Field label="New commencement date" required><input name="starts_on" type="date" min={String(renewalTarget.ends_on ?? "")} defaultValue={String(renewalTarget.ends_on ?? "")} required /></Field>
                <Field label="New end date" required><input name="ends_on" type="date" min={String(renewalTarget.ends_on ?? "")} required /></Field>
                <Field label="New monthly rent" required><input name="monthly_rent" type="number" min={0.01} step="0.01" defaultValue={Number(renewalTarget.monthly_rent ?? 0)} required /></Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setRenewalTarget(null)}>Cancel</button>
                <button type="submit" className="btn primary">Create renewal</button>
              </div>
            </form>
          </Modal>
        )}

        {terminationTarget && (
          <Modal title="Terminate lease" onClose={() => setTerminationTarget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Terminate <strong>{String(terminationTarget.reference ?? "this lease")}</strong> for {String(terminationTarget.tenant_name ?? "the tenant")}? The unit will become available when no other current lease exists.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setTerminationTarget(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={(e) => void onTerminateLeaseSubmit(e as any)}>Confirm termination</button>
              </div>
            </div>
          </Modal>
        )}

        {confirmVoidInvoice && (
          <Modal title="Void invoice" onClose={() => setConfirmVoidInvoice(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Void invoice <strong>{String(confirmVoidInvoice.number ?? "—")}</strong> for {String(confirmVoidInvoice.tenant_name ?? "the tenant")}? This action cannot be undone and the invoice will be excluded from collection reporting.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setConfirmVoidInvoice(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={onVoidInvoiceConfirm}>Confirm void</button>
              </div>
            </div>
          </Modal>
        )}

        {confirmRejectBudget && (
          <Modal title="Reject budget" onClose={() => setConfirmRejectBudget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Reject the <strong>{String(confirmRejectBudget.category ?? "budget")}</strong> for {String(confirmRejectBudget.property_name ?? "this property")} ({String(confirmRejectBudget.year ?? "—")})? This budget line will return to draft status for revision.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setConfirmRejectBudget(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={onRejectBudgetConfirm}>Confirm reject</button>
              </div>
            </div>
          </Modal>
        )}

        {reconciliationTarget && (
          <Modal title="Reconcile service charge" onClose={() => setReconciliationTarget(null)}>
            <form onSubmit={submitServiceChargeReconciliation} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <strong>{String(reconciliationTarget.name ?? "Service charge")}</strong>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{String(reconciliationTarget.property_name ?? "")} · annual budget {kM(reconciliationTarget.annual_budget)}</p>
              </div>
              <div className="grid-2">
                <Field label="Period start" required><input name="period_start" type="date" required /></Field>
                <Field label="Period end" required><input name="period_end" type="date" required /></Field>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>Approved and paid property expenses in this period are compared with the prorated budget. The result starts in draft for review.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setReconciliationTarget(null)}>Cancel</button>
                <button type="submit" className="btn primary">Run reconciliation</button>
              </div>
            </form>
          </Modal>
        )}

        {documentRejectTarget && (
          <Modal title="Reject tenant document" onClose={() => setDocumentRejectTarget(null)}>
            <form onSubmit={submitDocumentRejection} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Record why <strong>{String(documentRejectTarget.document_number ?? documentRejectTarget.document_type ?? "this document")}</strong> cannot be accepted. The reason remains visible in its compliance record.</p>
              <Field label="Rejection reason" required><textarea name="reason" rows={4} required placeholder="Describe the missing, invalid, or expired evidence" /></Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setDocumentRejectTarget(null)}>Cancel</button>
                <button type="submit" className="btn danger">Reject document</button>
              </div>
            </form>
          </Modal>
        )}

        {matchTarget && (
          <Modal title="Match Bank Transaction" onClose={() => setMatchTarget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Transaction</span>
                  <strong className="mono">{String(matchTarget.reference ?? "—")}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Date</span>
                  <strong className="mono">{fmtDate(matchTarget.transacted_on)}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Amount</span>
                  <strong className="mono">{kM(matchTarget.amount)}</strong>
                </div>
              </div>
              <form onSubmit={submitBankMatch} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Matching Receipt" required>
                  <select name="receipt" required defaultValue="">
                    <option value="" disabled>Select receipt</option>
                    {receiptOptions.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>{String(r.number)} · {kM(r.amount)}</option>
                    ))}
                  </select>
                </Field>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setMatchTarget(null)}>Cancel</button>
                  <button type="submit" className="btn primary">Match Transaction</button>
                </div>
              </form>
            </div>
          </Modal>
        )}
    </>
  );
}
