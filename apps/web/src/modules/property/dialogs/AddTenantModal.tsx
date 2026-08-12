"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/module-ui";
import type { AddTenantModalProps } from "../types";

export function AddTenantModal({ open, onClose, onSubmit, properties = [] }: AddTenantModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName,
        email,
        phone_number: phone,
        national_id: nationalId,
        property_id: propertyId,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add New Tenant" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <Field label="Full Name" required>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Samuel Njuguna" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <Field label="Email Address" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. samuel@example.com" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <Field label="Phone Number" required>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +254712345678" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        <Field label="National ID / Passport No">
          <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="e.g. 29384910" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }} />
        </Field>

        {properties.length > 0 && (
          <Field label="Assigned Property">
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontWeight: 600 }}>
              <option value="">Select Property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={onClose} style={{ fontWeight: 700 }}>Cancel</button>
          <button type="submit" className="btn primary" disabled={submitting} style={{ fontWeight: 800 }}>
            {submitting ? "Adding…" : "Create Tenant"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
