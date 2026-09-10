"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Modal, Field } from "@/components/module-ui";
import { Row } from "../../types/facility.types";

export function EditContractorModal({
  contractor,
  onClose,
  onSaved,
  organizationId,
}: {
  contractor: Row | null;
  onClose: () => void;
  onSaved: () => void;
  organizationId?: string | null;
}) {
  const isEditing = Boolean(contractor?.id);

  const [name, setName] = useState(contractor ? String(contractor.name ?? "") : "");
  const [specialty, setSpecialty] = useState(contractor ? String(contractor.specialty ?? "") : "");
  const [contactName, setContactName] = useState(contractor ? String(contractor.contact_name ?? "") : "");
  const [email, setEmail] = useState(contractor ? String(contractor.email ?? "") : "");
  const [phone, setPhone] = useState(contractor ? String(contractor.phone ?? "") : "");
  const [emergencyPhone, setEmergencyPhone] = useState(contractor ? String(contractor.emergency_phone ?? "") : "");
  const [pinNumber, setPinNumber] = useState(contractor ? String(contractor.pin_number ?? "") : "");
  const [registrationNumber, setRegistrationNumber] = useState(contractor ? String(contractor.registration_number ?? "") : "");
  const [coverageAreas, setCoverageAreas] = useState(contractor ? String(contractor.coverage_areas ?? "") : "");
  const [status, setStatus] = useState(contractor ? String(contractor.status ?? "active") : "active");
  const [approvalStatus, setApprovalStatus] = useState(contractor ? String(contractor.approval_status ?? "approved") : "approved");
  const [insuranceExpiresOn, setInsuranceExpiresOn] = useState(contractor ? String(contractor.insurance_expires_on ?? "") : "");
  const [licenseExpiresOn, setLicenseExpiresOn] = useState(contractor ? String(contractor.license_expires_on ?? "") : "");
  const [taxComplianceExpiresOn, setTaxComplianceExpiresOn] = useState(contractor ? String(contractor.tax_compliance_expires_on ?? "") : "");

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedPropertyIds, setAssignedPropertyIds] = useState<string[]>(() => {
    if (!contractor?.assigned_properties) return [];
    if (Array.isArray(contractor.assigned_properties)) {
      return contractor.assigned_properties.map((p: any) => typeof p === "object" ? String(p.id) : String(p));
    }
    return [];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProps() {
      try {
        const res = await apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.results || [];
          setProperties(list.map((p: any) => ({ id: String(p.id), name: String(p.name) })));
        }
      } catch (err) {
        console.error("Failed to load properties for contractor assignment", err);
      }
    }
    void loadProps();
  }, [organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Provider or company name is required.");
      return;
    }
    setSaving(true);
    setError("");

    const payload: Record<string, any> = {
      name: name.trim(),
      specialty: specialty.trim() || "General Maintenance",
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      emergency_phone: emergencyPhone.trim(),
      pin_number: pinNumber.trim(),
      registration_number: registrationNumber.trim(),
      coverage_areas: coverageAreas.trim(),
      status,
      approval_status: approvalStatus,
      insurance_expires_on: insuranceExpiresOn || null,
      license_expires_on: licenseExpiresOn || null,
      tax_compliance_expires_on: taxComplianceExpiresOn || null,
      assigned_properties: assignedPropertyIds,
    };

    try {
      const endpoint = isEditing ? `/facility/contractors/${contractor?.id}/` : "/facility/contractors/";
      const method = isEditing ? "PATCH" : "POST";
      const res = await apiFetch(
        endpoint,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        organizationId
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || Object.values(errData).flat().join(" ") || "Failed to save service provider.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProperty = (id: string) => {
    setAssignedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <Modal
      title={isEditing ? `Edit Service Provider: ${contractor?.name}` : "Register New Service Provider / Contractor"}
      onClose={onClose}
      wide
    >
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Section 1: Basic Company & Specialty Info */}
        <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
            🏢 Company & Trade Specialty
          </h3>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Company / Provider Name" required>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Total Security Ltd or Naki Cleaners"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Specialty / Trade Category" required>
              <input
                required
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Security, Cleaning, Lift Maintenance, Plumbing"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
            📞 Contact Persons & Emergency Dispatch
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Primary Contact Person">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. John Doe (Operations Manager)"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Primary Phone Number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +254 700 000 000"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Official Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. service@totalsecurity.co.ke"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="24/7 Emergency Hotline">
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="e.g. +254 711 999 999 (Rapid Response)"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
          </div>
        </div>

        {/* Section 3: Statutory Compliance & Tax */}
        <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
            📜 Statutory Compliance & Expiry Dates
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="KRA Tax PIN">
              <input
                value={pinNumber}
                onChange={(e) => setPinNumber(e.target.value.toUpperCase())}
                placeholder="e.g. P051234567Z"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Business / Registration No.">
              <input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. CPR/2021/12345"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Public Liability Insurance Expiry">
              <input
                type="date"
                value={insuranceExpiresOn}
                onChange={(e) => setInsuranceExpiresOn(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="NCA / Professional License Expiry">
              <input
                type="date"
                value={licenseExpiresOn}
                onChange={(e) => setLicenseExpiresOn(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Tax Compliance Certificate Expiry">
              <input
                type="date"
                value={taxComplianceExpiresOn}
                onChange={(e) => setTaxComplianceExpiresOn(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>
            <Field label="Operational Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              >
                <option value="active">Active (Available for Work Orders)</option>
                <option value="review">Under Review / KYC Verification</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Compliance Expired</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Section 4: Property Assignment */}
        {properties.length > 0 && (
          <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
              🏢 Assigned Properties
            </h3>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)" }}>
              Select which properties this contractor is contracted to service (leave unchecked for portfolio-wide).
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {properties.map((p) => {
                const checked = assignedPropertyIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: checked ? "rgba(37, 99, 235, 0.12)" : "var(--surface)",
                      border: checked ? "1.5px solid var(--color-info)" : "1px solid var(--border)",
                      color: checked ? "var(--color-info)" : "var(--text-primary)",
                      fontWeight: checked ? 700 : 500,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProperty(p.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving} style={{ fontWeight: 800 }}>
            {saving ? "Saving Provider..." : isEditing ? "Save Changes" : "Create Service Provider"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
