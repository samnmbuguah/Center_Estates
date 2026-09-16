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
  BillingContext,
} from "../../types/property.types";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { kM, kN, fmtDate } from "../../utils/property.utils";
import { TenantApplicationCard } from "@/components/tenant-application-card";
import { BulkTenantUploader } from "@/components/bulk-tenant-uploader";
import { useState, useMemo } from "react";
import { Autocomplete, Button, MenuItem, TextField } from "@mui/material";


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
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid-2">
        <TextField fullWidth size="small" label="Tenant name" value={form.name} onChange={set("name")} required slotProps={{ htmlInput: { "data-testid": "edit-tenant-name" } }} />
        <Field label="Tenant Type">
          <TextField select fullWidth size="small" value={form.tenant_type} onChange={set("tenant_type")}>
            <MenuItem value="company">Company</MenuItem>
            <MenuItem value="individual">Individual</MenuItem>
          </TextField>
        </Field>
      </div>
      <div className="grid-2">
        <TextField fullWidth size="small" label="Email" type="email" value={form.email} onChange={set("email")} slotProps={{ htmlInput: { "data-testid": "edit-tenant-email" } }} />
        <TextField fullWidth size="small" label="Phone" value={form.phone} onChange={set("phone")} slotProps={{ htmlInput: { "data-testid": "edit-tenant-phone" } }} />
      </div>
      <div className="grid-2">
        <TextField fullWidth size="small" label="KRA PIN / Tax ID" value={form.tax_id} onChange={set("tax_id")} placeholder="e.g. P051234567X" />
        <TextField fullWidth size="small" label="Registration number" value={form.registration_number} onChange={set("registration_number")} />
      </div>
      <TextField fullWidth size="small" label="Billing address" multiline minRows={2} value={form.billing_address} onChange={set("billing_address")} />
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Button type="button" variant="outlined" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained" data-testid="edit-tenant-save">Save Changes</Button>
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
      <TextField fullWidth size="small" label="Reason for voiding" multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Explain why this credit note is being voided…" slotProps={{ htmlInput: { "data-testid": "void-cn-reason" } }} />
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Button type="button" variant="outlined" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained" color="error" disabled={!reason.trim()} data-testid="void-cn-confirm">Void Credit Note</Button>
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
  wizardStep: number;
  setWizardStep: (v: number) => void;
  propertyData: Record<string, string>;
  setPropertyData: (v: Record<string, string> | ((p: Record<string, string>) => Record<string, string>)) => void;
  unitMix: { type: string; count: number; size: number }[];
  setUnitMix: (v: any) => void;
  tenantOptions: Row[];
  ownerOptions: Row[];
  unitOptions: Row[];
  invoiceOptions: Row[];
  receiptOptions: Row[];
  propertyOptions: Row[];
  leaseOptions: LeaseRow[];
  billingContext?: BillingContext | null;
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
  onInvoiceTypeChange: (invoiceType: string) => any;
  canOperate: boolean;
  canLease: boolean;
  canFinance: boolean;
  canApprove: boolean;
  activeProperty: { id: string; name: string } | null;
  setTab: (t: PropertyTab) => void;
  standaloneOnboarding?: boolean;
  fetchData?: () => void;
  previewInvoice?: () => void;
  showBulkTenantUpload?: boolean;
  setShowBulkTenantUpload?: (v: boolean) => void;
  error?: string;
  setError?: (err: string) => void;
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
    wizardStep, setWizardStep,
    propertyData, setPropertyData,
    unitMix, setUnitMix,
    tenantOptions, ownerOptions, unitOptions, invoiceOptions, receiptOptions, propertyOptions, leaseOptions,
    billingContext,
    invoicePreview, setInvoicePreview,
    invoiceDraft, setInvoiceDraft,
    onAddPropertySubmit, onAddTenantSubmit, onAddLeaseSubmit, onRecordReceiptSubmit,
    onComposeInvoiceSubmit, onUploadDocSubmit, onAddServiceChargeSubmit, onFinancialIntakeSubmit,
    onMatchSubmit, onRenewLeaseSubmit, onTerminateLeaseSubmit, onReconcileSubmit,
    onRejectDocumentSubmit, onVoidInvoiceConfirm, onRejectBudgetConfirm,     onInvoiceLeaseChange, onInvoiceTypeChange,
    canOperate, canLease, canFinance, canApprove, activeProperty, setTab,
    standaloneOnboarding = false,
    fetchData = () => {},
    previewInvoice = () => {},
    showBulkTenantUpload = false,
    setShowBulkTenantUpload = () => {},
    error = "",
    setError = () => {},
  } = props;
  const [receiptPayerType, setReceiptPayerType] = useState<"tenant" | "landlord">("tenant");
  const [selectedReceiptPayerKey, setSelectedReceiptPayerKey] = useState<string>("");
  const [receiptAmountInput, setReceiptAmountInput] = useState<string>("");

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
    } else if (key === "invoice_type") {
      onInvoiceTypeChange(value);
    } else {
      setInvoiceDraft((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const selectedPayerId = selectedReceiptPayerKey ? selectedReceiptPayerKey.split(":")[1] : "";

  const selectedTenantObj = receiptPayerType === "tenant" ? tenantOptions.find(t => String(t.id) === selectedPayerId) : null;
  const selectedOwnerObj = receiptPayerType === "landlord" ? ownerOptions.find(o => String(o.id) === selectedPayerId) : null;
  const receiptPayerOptions: Row[] = receiptPayerType === "tenant" ? tenantOptions : ownerOptions;
  const selectedReceiptPayer: Row | null = receiptPayerOptions.find((option) => String(option.id) === selectedPayerId) ?? null;

  const payerInvoices = useMemo(() => {
    if (!selectedPayerId) return [];
    return invoiceOptions.filter(inv => {
      if (receiptPayerType === "tenant") {
        const tId = (inv as any).lease?.tenant?.id || (inv as any).tenant_id || (inv as any).lease?.tenant_id || ((inv as any).lease && typeof (inv as any).lease === "object" ? (inv as any).lease.tenant : null);
        return String(tId) === selectedPayerId || String((inv as any).tenant) === selectedPayerId || String((inv as any).tenant_id) === selectedPayerId;
      } else {
        return String((inv as any).owner_id || (inv as any).owner?.id || (inv as any).owner) === selectedPayerId;
      }
    });
  }, [selectedPayerId, receiptPayerType, invoiceOptions]);

  const payerReceipts = useMemo(() => {
    if (!selectedPayerId) return [];
    return receiptOptions.filter(rcpt => {
      if (receiptPayerType === "tenant") {
        return String((rcpt as any).tenant?.id || (rcpt as any).tenant_id || (rcpt as any).tenant) === selectedPayerId;
      } else {
        return String((rcpt as any).owner?.id || (rcpt as any).owner_id || (rcpt as any).owner) === selectedPayerId;
      }
    });
  }, [selectedPayerId, receiptPayerType, receiptOptions]);

  const openPayerInvoices = payerInvoices.filter(inv => Number(inv.balance ?? inv.amount ?? 0) > 0);
  const totalOutstanding = openPayerInvoices.reduce((sum, inv) => sum + Number(inv.balance ?? inv.amount ?? 0), 0);
  const payerWalletCredit = Number((selectedTenantObj as any)?.wallet_balance ?? (selectedTenantObj as any)?.wallet_credit ?? (selectedTenantObj as any)?.metadata?.wallet_balance ?? 0);

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

        {/* ─── BULK TENANT UPLOAD ─── */}
        {showBulkTenantUpload && (
          <Modal
            title="⬆ Upload Tenants in Bulk"
            onClose={() => setShowBulkTenantUpload(false)}
            extraWide
          >
            <BulkTenantUploader
              onDone={() => { setShowBulkTenantUpload(false); setTab("tenants"); loadData(); }}
              onCancel={() => setShowBulkTenantUpload(false)}
            />
          </Modal>
        )}

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
              <div className="grid-1">
                <Field label="Lease Onboarding Type">
                  <select name="contract_type" defaultValue="paper_lease" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}>
                    <option value="paper_lease">📄 Existing Paper Lease (Already signed offline — Onboarded property)</option>
                    <option value="new_digital_signing">✍️ New Tenant (Issue digital offer letter for tenant portal signing)</option>
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
          <Modal title="Record payment receipt" onClose={() => setShowRecordReceipt(false)} wide>
            <form onSubmit={submitRecordReceipt} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: "10px 14px", background: "var(--surface-2)", fontSize: 13, color: "var(--text-primary)" }}>
                <strong>Record once, allocate safely.</strong> Select whether the payer is a tenant or landlord, then choose the payer. The system applies the organisation&apos;s configured priority matrix to their open balances: penalties, VAT, utilities, service charge, then rent. Any excess remains as wallet credit for a future invoice. For a bank transfer, add the bank reference, then use <strong>Bank reconciliation</strong> to match the statement line without creating another receipt.
              </div>
              <div className="grid-2">
                <Field label="Receipt number">
                  <input value="Generated automatically when posted" disabled aria-label="Receipt number generated automatically" />
                </Field>
                <Field label="Received On" required>
                  <input name="received_on" type="date" required />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Payer type" required>
                  <select name="payer_type" value={receiptPayerType} onChange={(event) => { setReceiptPayerType(event.target.value as "tenant" | "landlord"); setSelectedReceiptPayerKey(""); }} data-testid="receipt-payer-type">
                    <option value="tenant">Tenant</option>
                    <option value="landlord">Landlord / unit owner</option>
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "end", fontSize: 12, color: "var(--text-secondary)", paddingBottom: 8 }}>
                  Allocation is automatic; do not select a charge category here.
                </div>
              </div>
              <Field label="Payer" required>
                <input type="hidden" name="payer" value={selectedReceiptPayerKey} />
                <Autocomplete<Row, false, false, false>
                  key={receiptPayerType}
                  options={receiptPayerOptions}
                  value={selectedReceiptPayer}
                  onChange={(_, option) => setSelectedReceiptPayerKey(option ? `${receiptPayerType}:${String(option.id)}` : "")}
                  isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                  getOptionLabel={(option) => {
                    const unit = String((option as any).unit ?? (option as any).unit_code ?? "").trim();
                    const code = String((option as any).code ?? "").trim();
                    const phone = String((option as any).phone ?? "").trim();
                    return [String(option.name ?? "Unnamed payer"), unit && `Unit ${unit}`, code, phone].filter(Boolean).join(" · ");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      size="small"
                      data-testid="receipt-payer"
                      placeholder={receiptPayerType === "tenant" ? "Search name, house/unit, code or phone" : "Search landlord name, unit or code"}
                      helperText="Type at least part of the payer name, house/unit number, account code or phone."
                    />
                  )}
                />
              </Field>

              {selectedReceiptPayerKey && (
                <div style={{ background: "var(--surface-1, var(--color-slate-50))", border: "1px solid var(--border-color, var(--color-slate-200))", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)", fontWeight: 700 }}>
                        📄 Live Account Statement: {String(selectedTenantObj?.name ?? selectedOwnerObj?.name ?? "Client")}
                      </span>

                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Outstanding:</span>
                        <strong style={{ fontSize: 16, color: totalOutstanding > 0 ? "#e11d48" : "var(--color-success)" }}>
                          {kM(totalOutstanding)}
                        </strong>
                        {payerWalletCredit > 0 && (
                          <span style={{ fontSize: 12, background: "rgba(16, 185, 129, 0.15)", color: "var(--color-emerald-deep)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                            Wallet Credit: {kM(payerWalletCredit)}
                          </span>
                        )}
                      </div>
                    </div>
                    {totalOutstanding > 0 && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ background: "rgba(37, 99, 235, 0.08)", borderColor: "rgba(37, 99, 235, 0.3)", color: "var(--color-info-strong)", fontWeight: 700 }}
                        onClick={() => setReceiptAmountInput(String(totalOutstanding))}
                      >
                        ⚡ Auto-fill Full Balance ({kM(totalOutstanding)})
                      </button>
                    )}
                  </div>

                  {openPayerInvoices.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Pending Invoices ({openPayerInvoices.length})
                      </div>
                      <div style={{ maxHeight: 110, overflowY: "auto", border: "1px solid var(--border-color, var(--color-slate-200))", borderRadius: 6 }}>
                        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", textAlign: "left" }}>
                          <thead style={{ background: "var(--surface-2, var(--color-slate-100))", position: "sticky", top: 0 }}>
                            <tr>
                              <th style={{ padding: "4px 8px" }}>Invoice #</th>
                              <th style={{ padding: "4px 8px" }}>Due Date</th>
                              <th style={{ padding: "4px 8px", textAlign: "right" }}>Billed</th>
                              <th style={{ padding: "4px 8px", textAlign: "right" }}>Balance Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {openPayerInvoices.map(inv => (
                              <tr key={String(inv.id)} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                <td style={{ padding: "4px 8px", fontWeight: 600 }}>{String(inv.number)}</td>
                                <td style={{ padding: "4px 8px", color: "var(--text-secondary)" }}>{String(inv.due_on || "—")}</td>
                                <td style={{ padding: "4px 8px", textAlign: "right" }}>{kM(Number(inv.amount || 0))}</td>
                                <td style={{ padding: "4px 8px", textAlign: "right", color: "#e11d48", fontWeight: 700 }}>{kM(Number(inv.balance || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--color-success)", fontStyle: "italic", background: "rgba(22, 163, 74, 0.08)", padding: "6px 10px", borderRadius: 4 }}>
                      ✓ All invoices paid up to date. Any new payment will be credited to available wallet advance.
                    </div>
                  )}

                  {payerReceipts.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span><strong>Recent Payments:</strong></span>
                      {payerReceipts.slice(0, 3).map(r => (
                        <span key={String(r.id)}>
                          {String(r.number)}: {kM(Number(r.amount || 0))} ({String(r.received_on || "").slice(5, 10)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid-2">
                <Field label="Amount (KES)" required>
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    required
                    placeholder="0"
                    value={receiptAmountInput}
                    onChange={(e) => setReceiptAmountInput(e.target.value)}
                    data-testid="receipt-amount-input"
                  />
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
              <div className="card" style={{ padding: "10px 14px", background: "var(--surface-2)", fontSize: 12, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>Allocation preview</strong>
                <div style={{ marginTop: 4 }}>
                  This payment will be applied automatically across the selected payer&apos;s open invoices using the configured priority order. If the payment exceeds their outstanding balance, the remainder is saved as wallet credit.
                </div>
              </div>
              <Field label="Payment reference">
                <input name="external_reference" placeholder="Bank reference or M-Pesa transaction code" autoCapitalize="characters" />
                <small className="muted">M-Pesa codes are required and can only be posted once.</small>
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowRecordReceipt(false)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="receipt-save-btn">Post Receipt</button>
              </div>
            </form>
          </Modal>
        )}


        {showInvoiceComposer && (
          <Modal title="Create manual invoice draft" onClose={() => { setShowInvoiceComposer(false); setInvoicePreview(null); }} wide>
            <form onSubmit={submitInvoiceDraft} style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="invoice-composer">
              {billingContext ? (
                <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text-primary)" }}>
                  📅 <strong>Billing Pipeline Context:</strong> {billingContext.label} ({billingContext.months_count} billing {billingContext.months_count === 1 ? "month" : "months"}). Rent subtotal automatically calculated for {billingContext.months_count} {billingContext.months_count === 1 ? "month" : "months"}.
                </div>
              ) : (
                <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text-primary)" }}>
                  💡 <strong>Bulk Billing Tip:</strong> For standard monthly rent and service charges across all units, use the <strong>Billing Pipeline</strong> tab to generate and issue all invoices in 1 click. Use this form only for manual, one-off, or custom adjustments.
                </div>
              )}
              <div className="grid-2">
                <Field label="Invoice number">
                  <input readOnly value="Auto-generated on save" aria-label="Invoice number is generated automatically" />
                </Field>
                <Field label="Tenant & Unit (Lease)" required>
                  <select required value={invoiceDraft.lease} onChange={(e) => updateInvoiceDraft("lease", e.target.value)} data-testid="invoice-lease">
                    <option value="" disabled>Select tenant & unit</option>
                    {leaseOptions.map((lease) => <option key={String(lease.id)} value={String(lease.id)}>{String(lease.tenant_name)} · {String(lease.unit_code)} ({String(lease.reference)})</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Invoice type (Category)" required>
                  <select value={invoiceDraft.invoice_type} onChange={(e) => updateInvoiceDraft("invoice_type", e.target.value)}>
                    <option value="rent">Rent</option>
                    <option value="security_deposit">Security Deposit</option>
                    <option value="service_charge">Service charge</option>
                    <option value="utility">Utility</option>
                    <option value="move_in">Move-in charges</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="VAT Tax" required>
                  <select value={invoiceDraft.tax_rate} onChange={(e) => updateInvoiceDraft("tax_rate", e.target.value)} data-testid="invoice-vat">
                    <option value="16">Standard VAT (16%)</option><option value="0">Zero-rated / No VAT (0%)</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <div>
                  <Field label="Invoice Date (Issued on)" required>
                    <input type="date" required value={invoiceDraft.issued_on} onChange={(e) => updateInvoiceDraft("issued_on", e.target.value)} />
                  </Field>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>Date this invoice is issued to tenant</span>
                </div>
                <div>
                  <Field label="Payment Due Date (Pay before)" required>
                    <input type="date" required min={invoiceDraft.issued_on} value={invoiceDraft.due_on} onChange={(e) => updateInvoiceDraft("due_on", e.target.value)} />
                  </Field>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>Deadline for tenant payment</span>
                </div>
              </div>
              <div>
                <Field label={`Billable Amount / ${{ rent: "Rent", security_deposit: "Security Deposit", service_charge: "Service charge", utility: "Utility", move_in: "Move-in charges", other: "Other charge" }[invoiceDraft.invoice_type] || "Charge"} (Excl. VAT)${billingContext && billingContext.months_count > 1 ? ` — ${billingContext.months_count} Months Total` : ""}`} required>
                  <input type="number" min="0.01" step="0.01" required placeholder="e.g. 100000" value={invoiceDraft.subtotal} onChange={(e) => updateInvoiceDraft("subtotal", e.target.value)} data-testid="invoice-subtotal" />
                </Field>
                <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>
                  {billingContext && billingContext.months_count > 1
                    ? `Total amount in Ksh across ${billingContext.months_count} months before VAT (approx. ${kM(Number(invoiceDraft.subtotal || 0) / billingContext.months_count)} / month)`
                    : invoiceDraft.invoice_type === "security_deposit"
                      ? (() => {
                          const sel = leaseOptions.find((l) => String(l.id) === invoiceDraft.lease) as unknown as Record<string, unknown> | undefined;
                          const dep = Number(sel?.deposit ?? 0);
                          return dep > 0
                            ? `🛡️ Security deposit (Ksh ${dep.toLocaleString()}) auto-filled from lease agreement. Security deposits are zero-rated (0% VAT).`
                            : "Enter the security deposit amount to bill the tenant. Security deposits are zero-rated for VAT.";
                        })()
                      : invoiceDraft.invoice_type === "rent"
                        ? `Monthly rent is filled from the selected lease${invoiceDraft.subtotal ? ` (Ksh ${invoiceDraft.subtotal})` : ""}; you can adjust it. For recurring billing across all units, use Billing Pipeline instead.`
                        : invoiceDraft.invoice_type === "service_charge"
                          ? invoiceDraft.subtotal
                            ? `Service charge auto-filled from the billing profile for this lease (Ksh ${invoiceDraft.subtotal}). Adjust if needed, or configure recurring charges in Billing Pipeline.`
                            : "No service-charge profile found for this lease. Enter the amount manually, or set up a recurring billing profile in Billing Pipeline for automated bulk invoicing."
                          : invoiceDraft.invoice_type === "utility"
                            ? invoiceDraft.subtotal
                              ? `Utility — estimated from billing profile rate (Ksh ${invoiceDraft.subtotal}). Confirm meter consumption and adjust before saving. Bulk pipeline will use the latest approved reading.`
                              : "No utility profile found. Enter the meter-based amount manually. Bulk pipeline auto-calculates from readings when available."
                            : invoiceDraft.invoice_type === "move_in"
                              ? (() => {
                                  const sel = leaseOptions.find((l) => String(l.id) === invoiceDraft.lease) as unknown as Record<string, unknown> | undefined;
                                  const dep = Number(sel?.deposit ?? 0);
                                  const rent = Number(sel?.monthly_rent ?? 0);
                                  const hint = dep > 0 && rent > 0 ? `Suggested: deposit Ksh ${dep.toLocaleString()} + first rent Ksh ${rent.toLocaleString()} = Ksh ${(dep + rent).toLocaleString()}. ` : dep > 0 ? `Deposit on file: Ksh ${dep.toLocaleString()}. ` : "";
                                  return `${hint}Enter the move-in total (deposit, fees, pro-rata rent). Leave empty to type manually.`;
                                })()
                              : "Enter the one-off amount for this invoice. For recurring charges, configure the unit billing schedule and use Billing Pipeline for bulk generation."}
                </span>
              </div>


              {Number(invoiceDraft.subtotal) > 0 && (
                <section className="card" style={{ padding: 14, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Estimated Invoice Breakdown</div>
                    {billingContext && billingContext.months_count > 1 && (
                      <span style={{ fontSize: 11, background: "rgba(59, 130, 246, 0.12)", color: "var(--color-info)", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                        {billingContext.label} · {billingContext.months_count} Months
                      </span>
                    )}
                  </div>
                  <div className="grid-3">
                    <div>
                      <span className="muted" style={{ fontSize: 11 }}>Base Amount (Excl. VAT)</span>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{kM(Number(invoiceDraft.subtotal))}</div>
                      {billingContext && billingContext.months_count > 1 && (
                        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{kM(Number(invoiceDraft.subtotal) / billingContext.months_count)} / month</div>
                      )}
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: 11 }}>VAT ({invoiceDraft.tax_rate}%)</span>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{kM(Number(invoiceDraft.subtotal) * (Number(invoiceDraft.tax_rate) / 100))}</div>
                      {billingContext && billingContext.months_count > 1 && (
                        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{kM((Number(invoiceDraft.subtotal) * (Number(invoiceDraft.tax_rate) / 100)) / billingContext.months_count)} / month</div>
                      )}
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: 11 }}>Total Payable by Tenant</span>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: "var(--color-success)" }}>
                        {kM(Number(invoiceDraft.subtotal) * (1 + Number(invoiceDraft.tax_rate) / 100))}
                      </div>
                      {billingContext && billingContext.months_count > 1 && (
                        <div className="muted" style={{ fontSize: 10, marginTop: 2, color: "var(--color-success)" }}>{kM((Number(invoiceDraft.subtotal) * (1 + Number(invoiceDraft.tax_rate) / 100)) / billingContext.months_count)} / month</div>
                      )}
                    </div>
                  </div>

                  {/* Monthly Breakdown Table for Multi-Month / Quarterly Periods */}
                  {billingContext && billingContext.months_count > 1 && (
                    <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>📊 Monthly Breakdown ({billingContext.months_count} Months)</span>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", textAlign: "left" }}>
                          <thead>
                            <tr style={{ background: "var(--surface-3)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                              <th style={{ padding: "6px 8px" }}>#</th>
                              <th style={{ padding: "6px 8px" }}>Billing Month</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>Base Rent (Excl. VAT)</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>VAT ({invoiceDraft.tax_rate}%)</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>Month Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const count = billingContext.months_count;
                              const basePerMonth = Number(invoiceDraft.subtotal) / count;
                              const vatRate = Number(invoiceDraft.tax_rate) / 100;
                              const vatPerMonth = basePerMonth * vatRate;
                              const totalPerMonth = basePerMonth + vatPerMonth;

                              const [sy, sm] = (billingContext.period_start || "").split("-").map(Number);
                              const rows = [];
                              for (let i = 0; i < count; i++) {
                                const d = sy && sm ? new Date(sy, sm - 1 + i, 1) : null;
                                const monthLabel = d ? d.toLocaleDateString("en-KE", { month: "short", year: "numeric" }) : `Month ${i + 1}`;
                                rows.push(
                                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{i + 1}</td>
                                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{monthLabel}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }} className="mono">{kM(basePerMonth)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }} className="mono">{kM(vatPerMonth)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "var(--color-success)" }} className="mono">{kM(totalPerMonth)}</td>
                                  </tr>
                                );
                              }
                              return rows;
                            })()}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: 700, background: "var(--surface-3)", borderTop: "2px solid var(--border)" }}>
                              <td colSpan={2} style={{ padding: "6px 8px" }}>Total ({billingContext.months_count} Months)</td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }} className="mono">{kM(Number(invoiceDraft.subtotal))}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }} className="mono">{kM(Number(invoiceDraft.subtotal) * (Number(invoiceDraft.tax_rate) / 100))}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--color-success)" }} className="mono">{kM(Number(invoiceDraft.subtotal) * (1 + Number(invoiceDraft.tax_rate) / 100))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {invoicePreview && (
                <section className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }} aria-live="polite" data-testid="invoice-preview">
                  <strong>{invoicePreview.tenant} · {invoicePreview.property} · Unit {invoicePreview.unit}</strong>
                  <div className="grid-3" style={{ marginTop: 10 }}>
                    <div><span className="muted">Subtotal</span><div className="mono">{kM(invoicePreview.subtotal)}</div></div>
                    <div><span className="muted">VAT ({invoicePreview.tax_rate}%)</span><div className="mono">{kM(invoicePreview.tax_amount)}</div></div>
                    <div><span className="muted">Invoice total</span><div className="mono"><strong>{kM(invoicePreview.total)}</strong></div></div>
                  </div>
                </section>
              )}
              {error && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, padding: "10px 14px", color: "var(--danger)", fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>The invoice will be saved as a draft for review and approval before being dispatched to the tenant.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => { setShowInvoiceComposer(false); setInvoicePreview(null); setError(""); }}>Cancel</button>
                <button type="button" className="btn ghost" onClick={() => void previewInvoice()} data-testid="invoice-preview-btn">Preview invoice</button>
                <button type="submit" className="btn primary" disabled={!invoiceDraft.lease || Number(invoiceDraft.subtotal) <= 0} data-testid="invoice-save-draft">Save reviewable draft</button>
              </div>
            </form>
          </Modal>
        )}

        {showAddServiceCharge && (
          <Modal title="Set up service charge" onClose={() => setShowAddServiceCharge(false)} wide>
            <form onSubmit={submitServiceCharge} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Property" required>
                <select name="property" required defaultValue={String(activeProperty?.id ?? (propertyOptions[0]?.id ?? ""))}>
                  {!activeProperty && !propertyOptions[0] && <option value="" disabled>Select property</option>}
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
                    <Field label="Credit note number (auto-assigned if empty)">
                      <input name="number" placeholder="Auto-assigned (e.g. CN-2026-0001)" />
                    </Field>
                    <Field label="Issued on" required>
                      <input name="issued_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                    </Field>
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
                    <select name="property" required defaultValue={String(activeProperty?.id ?? (propertyOptions[0]?.id ?? ""))}>
                      {!activeProperty && !propertyOptions[0] && <option value="" disabled>Select property</option>}
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
