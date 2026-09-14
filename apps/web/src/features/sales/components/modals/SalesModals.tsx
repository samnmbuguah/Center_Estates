"use client";

import { useState } from "react";
import { Field, Modal, Panel, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtMoney } from "../../utils/sales.utils";
import { DField, FormError } from "../SalesUiComponents";

export function RegisterBuyerModal({
  open,
  onClose,
  onSubmit,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>({
    reference: "",
    full_name: "",
    email: "",
    phone: "",
    id_number: "",
    tax_number: "",
    financing_type: "self",
    financier: "",
    address: "",
    sale_project: "",
    sale_unit: "",
    agreed_price: "",
    reservation_fee: "",
  });
  const [docsCheck, setDocsCheck] = useState({ offer_letter: false, id_copy: false, kra_pin: false });

  if (!open) return null;

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (step < 3) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  function handleSubmit() {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v) payload[k] = v;
    }
    onSubmit(payload);
  }

  const stepLabels = ["Buyer Info", "Purchase Details", "Review & Submit"];

  return (
    <Modal title="Register Buyer" onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
        {stepLabels.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  background: i + 1 <= step ? "var(--color-orange)" : "var(--color-surface-alt)",
                  color: i + 1 <= step ? "#fff" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? "var(--text)" : "var(--muted)" }}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i + 1 < step ? "var(--color-orange)" : "var(--color-surface-alt)", margin: "0 12px", borderRadius: 1 }} />
            )}
          </div>
        ))}
      </div>

      <FormError error={error} />

      {step === 1 && (
        <div>
          <div className="grid-2">
            <Field label="Buyer Reference" required>
              <input value={formData.reference} onChange={(e) => updateField("reference", e.target.value)} required placeholder="BUY-2026-0001" />
            </Field>
            <Field label="Full Legal Name" required>
              <input value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} required placeholder="e.g. Apex Holdings Ltd" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Email Address">
              <input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="buyer@domain.co.ke" />
            </Field>
            <Field label="Phone Number">
              <input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+254 700 000 000" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="National / Company ID" required>
              <input value={formData.id_number} onChange={(e) => updateField("id_number", e.target.value)} required placeholder="12345678" />
            </Field>
            <Field label="KRA PIN">
              <input value={formData.tax_number} onChange={(e) => updateField("tax_number", e.target.value)} placeholder="A000000000X" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Financing Type">
              <select value={formData.financing_type} onChange={(e) => updateField("financing_type", e.target.value)}>
                <option value="self">Self-Financed</option>
                <option value="bank">Bank-Financed</option>
              </select>
            </Field>
            <Field label="Financier (if bank-financed)">
              <input value={formData.financier} onChange={(e) => updateField("financier", e.target.value)} placeholder="e.g. KCB Bank" />
            </Field>
          </div>
          <Field label="Address">
            <textarea rows={2} value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Postal / physical address" />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="grid-2">
            <Field label="Project">
              <input value={formData.sale_project} onChange={(e) => updateField("sale_project", e.target.value)} placeholder="Project name or ID" />
            </Field>
            <Field label="Unit">
              <input value={formData.sale_unit} onChange={(e) => updateField("sale_unit", e.target.value)} placeholder="Unit code" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Agreed Price (KES)">
              <input type="number" min="1" value={formData.agreed_price} onChange={(e) => updateField("agreed_price", e.target.value)} placeholder="12500000" />
            </Field>
            <Field label="Deposit Amount (KES)">
              <input type="number" min="0" value={formData.reservation_fee} onChange={(e) => updateField("reservation_fee", e.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <Panel title="Buyer Summary" style={{ marginBottom: 14 }}>
            <div className="fc-detail-grid">
              <DField label="Name" value={formData.full_name || "—"} />
              <DField label="Email" value={formData.email || "—"} />
              <DField label="Phone" value={formData.phone || "—"} />
              <DField label="ID" value={<span className="mono">{formData.id_number || "—"}</span>} />
              <DField label="KRA PIN" value={<span className="mono">{formData.tax_number || "—"}</span>} />
              <DField label="Financing" value={formData.financing_type === "bank" ? "Bank-Financed" : "Self-Financed"} />
              <DField label="Financier" value={formData.financier || "—"} />
              {formData.agreed_price && <DField label="Price" value={<span className="mono">{fmtMoney(formData.agreed_price)}</span>} />}
              {formData.reservation_fee && <DField label="Deposit" value={<span className="mono">{fmtMoney(formData.reservation_fee)}</span>} />}
            </div>
          </Panel>

          <Panel title="Documents Checklist">
            <div style={{ padding: 18 }}>
              {([
                { key: "offer_letter", label: "Offer Letter" },
                { key: "id_copy", label: "Buyer ID Copy" },
                { key: "kra_pin", label: "KRA PIN Certificate" },
              ] as const).map((d) => (
                <label key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={docsCheck[d.key]}
                    onChange={(e) => setDocsCheck((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13 }}>{d.label}</span>
                </label>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "space-between" }}>
          <div>
            {step > 1 && <button type="button" className="btn ghost" onClick={prevStep}>← Previous</button>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            {step < 3 ? (
              <button type="button" className="btn primary" onClick={nextStep}>Next →</button>
            ) : (
              <button type="button" className="btn primary" onClick={handleSubmit}>Register Buyer</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function NewSaleModal({
  open,
  onClose,
  onSubmit,
  error,
  buyers,
  listings,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  buyers: Row[];
  listings: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="+ New Sale" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <div className="grid-2">
          <Field label="Sale Reference" required>
            <input name="reference" required placeholder="SALE-2026-0001" />
          </Field>
          <Field label="Buyer" required>
            <select name="buyer" required defaultValue="">
              <option value="" disabled>Select buyer…</option>
              {buyers.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.full_name ?? "—")} · {String(b.reference ?? "—")}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Unit Listing" required>
          <select name="listing" required defaultValue="">
            <option value="" disabled>Select listing…</option>
            {listings.map((l) => <option key={String(l.id)} value={String(l.id)}>{String(l.project_name ?? "—")} · {String(l.unit_code ?? "—")} · {fmtMoney(l.list_price)}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Agreed Price (KES)" required>
            <input name="agreed_price" type="number" min="1" required placeholder="12500000" />
          </Field>
          <Field label="Reservation Fee (KES)">
            <input name="reservation_fee" type="number" min="0" defaultValue="0" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Sale</button>
        </div>
      </form>
    </Modal>
  );
}

export function RecordVisitModal({
  open,
  onClose,
  onSubmit,
  error,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  projects: Row[];
}) {
  if (!open) return null;

  const now = new Date();
  const defaultRef = `VS-${now.getFullYear()}-${String(Date.now()).slice(-4)}`;
  const defaultVisitDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Modal title="📍 Record Site Visit (Clerk)" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        if (payload.visited_at) payload.visited_at = new Date(payload.visited_at).toISOString();
        onSubmit(payload);
      }}>
        <div className="grid-2">
          <Field label="Visit Reference (Auto-generated)">
            <input
              name="reference"
              defaultValue={defaultRef}
              placeholder="Auto-generated (e.g. VS-2026-0001)"
              style={{ background: "var(--surface-sunken, #f8fafc)", fontWeight: 600 }}
            />
          </Field>
          <Field label="Visitor Name" required>
            <input name="visitor_name" required placeholder="Client full name" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Phone">
            <input name="phone" placeholder="+254 700 000 000" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" placeholder="visitor@domain.co.ke" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Project" required>
            <select name="project" required defaultValue="">
              <option value="" disabled>Select project…</option>
              {projects.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name ?? "—")}</option>)}
            </select>
          </Field>
          <Field label="Interested Unit Type">
            <input name="interested_unit_type" placeholder="e.g. 3-Bedroom Apartment" />
          </Field>
        </div>
        <Field label="Visit Date & Time" required>
          <input name="visited_at" type="datetime-local" required defaultValue={defaultVisitDate} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} placeholder="Presentation summary, financing interest, next steps…" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Record Visit</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewListingModal({
  open,
  onClose,
  onSubmit,
  error,
  projects,
  units,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  projects: Row[];
  units: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="+ New Listing" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <Field label="Project" required>
          <select name="project" required defaultValue="">
            <option value="" disabled>Select project…</option>
            {projects.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name ?? "—")}</option>)}
          </select>
        </Field>
        <Field label="Unit" required>
          <select name="unit" required defaultValue="">
            <option value="" disabled>Select unit…</option>
            {units.map((u) => <option key={String(u.id)} value={String(u.id)}>{String(u.code ?? "—")} · {String(u.unit_type ?? "—")} · Floor {String(u.floor ?? "—")}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="List Price (KES)" required>
            <input name="list_price" type="number" min="1" required placeholder="12500000" />
          </Field>
          <Field label="Min. Deposit %">
            <input name="minimum_deposit_percent" type="number" min="0" max="100" defaultValue="10" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Listing</button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentActionModal({
  payment,
  onClose,
  onAction,
  error,
}: {
  payment: Row | null;
  onClose: () => void;
  onAction: (payload: { action: "verify" | "reject" | "reverse"; reason?: string }) => void;
  error: string;
}) {
  const [reason, setReason] = useState("");
  if (!payment) return null;
  const status = String(payment.status ?? "");

  return (
    <Modal title={status === "pending" ? `Verify Payment ${String(payment.reference ?? "")}` : `Reverse Payment ${String(payment.reference ?? "")}`} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Buyer</span><strong>{String(payment.buyer_name ?? "—")}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Sale</span><span className="mono">{String(payment.sale_reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Method</span><span>{String(payment.method ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Amount</span><strong className="mono">{fmtMoney(payment.amount)}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">External Ref</span><span className="mono">{String(payment.external_reference ?? "—")}</span></div>
      </div>
      {status === "pending" ? (
        <>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
            Approving allocates the full amount to the linked installment and recalculates commission gates. Rejecting requires a reason that is retained in the audit trail.
          </p>
          <Field label="Rejection Reason (required to reject)">
            <textarea name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. M-Pesa reference does not match, duplicate submission…" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" disabled={!reason.trim()} onClick={() => onAction({ action: "reject", reason })}>Reject</button>
            <button className="btn primary" onClick={() => onAction({ action: "verify" })}>✓ Approve Payment</button>
          </div>
        </>
      ) : (
        <>
          <Field label="Reversal Reason" required>
            <textarea name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this verified payment being reversed?" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn danger" onClick={() => onAction({ action: "reverse", reason })}>↩ Reverse Payment</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function TransitionModal({
  title,
  row,
  options,
  onClose,
  onSubmit,
  error,
}: {
  title: string;
  row: Row | null;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (payload: { status: string; notes?: string }) => void;
  error: string;
}) {
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  if (!row) return null;
  const needsNotes = target === "cancelled";

  return (
    <Modal title={title} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Reference</span><span className="mono">{String(row.reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Current Status</span><StatusPill value={String(row.status ?? "—")} /></div>
      </div>
      <Field label="Move to" required>
        <select value={target} onChange={(e) => setTarget(e.target.value)} required>
          <option value="" disabled>Select next status…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label={needsNotes ? "Reason (required for cancellation)" : "Notes"}>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={needsNotes ? "Required — retained in the audit trail." : "Optional note for the audit trail."} />
      </Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!target || (needsNotes && !notes.trim())} onClick={() => onSubmit({ status: target, notes })}>Apply Transition</button>
      </div>
    </Modal>
  );
}
