"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/module-ui";
import type { RecordReceiptModalProps } from "../types";

export function RecordReceiptModal({ open, onClose, onSubmit, tenants = [] }: RecordReceiptModalProps) {
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        tenant_id: tenantId,
        amount: Number(amount),
        payment_method: paymentMethod,
        reference_number: reference,
        payment_date: paymentDate,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Record Rent Receipt" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <Field label="Tenant" required>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required className="form-control" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }}>
            <option value="">Select Tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Amount Received (KES)" required>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 45000" required className="form-control" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <Field label="Payment Method" required>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-control" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }}>
            <option value="mpesa">M-PESA</option>
            <option value="bank_transfer">Bank Transfer / EFT</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </Field>

        <Field label="Transaction Reference / Receipt No">
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QKH782910A" className="form-control" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <Field label="Payment Date" required>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className="form-control" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={onClose} style={{ fontWeight: 700 }}>Cancel</button>
          <button type="submit" className="btn primary" disabled={submitting} style={{ fontWeight: 800 }}>
            {submitting ? "Recording…" : "Save Receipt"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
