"use client";

import { useState } from "react";
import { CheckCircle2, User, Building2, FileText, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";

export function GuidedTenantWizardModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (data: Record<string, any>) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    unitId: "102",
    unitCode: "U-102 (Floor 1)",
    propertyName: "Westlands Business Centre",
    monthlyRent: 45000,
    deposit: 45000,
    startDate: new Date().toISOString().slice(0, 10),
    leaseMonths: 12,
    tenantName: "",
    email: "",
    phone: "",
    nationalId: "",
    emergencyContact: "",
    emergencyPhone: "",
    autoInvoice: true,
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onComplete(formData);
    }, 1000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          maxWidth: 620,
          width: "100%",
          boxShadow: "0 25px 30px -5px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 28px", background: "#0f172a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#dc2626" }}>
              Guided Wizard
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: "2px 0 0", color: "#ffffff" }}>
              New Tenant Onboarding
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "#ffffff", fontSize: 24, fontWeight: 900, cursor: "pointer" }}>
            ×
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div style={{ background: "#f8fafc", padding: "14px 28px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {[
            { num: 1, label: "Unit & Lease Terms", icon: Building2 },
            { num: 2, label: "Tenant Profile", icon: User },
            { num: 3, label: "Lease & Billing", icon: FileText },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const completed = step > s.num;

            return (
              <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: active ? "#dc2626" : completed ? "#16a34a" : "#e2e8f0",
                    color: active || completed ? "#ffffff" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {completed ? <CheckCircle2 size={16} /> : s.num}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 900 : 700, color: active ? "#000000" : "#64748b" }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Unit & Terms */}
        {step === 1 && (
          <form onSubmit={handleNext} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                Select Property & Unit *
              </label>
              <select
                value={formData.unitId}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000", background: "#fff" }}
              >
                <option value="102">U-102 (Floor 1) — Westlands Business Centre</option>
                <option value="204">U-204 (Floor 2) — Westlands Business Centre</option>
                <option value="301">U-301 (Floor 3) — Parklands Plaza</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Monthly Rent (KES) *
                </label>
                <input
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => setFormData({ ...formData, monthlyRent: Number(e.target.value) })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Security Deposit (KES) *
                </label>
                <input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Lease Commencement Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Lease Duration (Months) *
                </label>
                <select
                  value={formData.leaseMonths}
                  onChange={(e) => setFormData({ ...formData, leaseMonths: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000", background: "#fff" }}
                >
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={24}>24 Months (2 Years)</option>
                  <option value={36}>36 Months (3 Years)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <button type="button" onClick={onClose} style={{ background: "#f1f5f9", border: 0, color: "#0f172a", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" style={{ background: "#dc2626", border: 0, color: "#ffffff", padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Next: Tenant Profile</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Tenant Profile */}
        {step === 2 && (
          <form onSubmit={handleNext} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Full Tenant Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe / Apex Solutions"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  National ID / Passport / Reg No *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 29384756"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="tenant@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="+254 711 000 000"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#000000" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: "#f1f5f9", border: 0, color: "#0f172a", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button type="submit" style={{ background: "#dc2626", border: 0, color: "#ffffff", padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Next: Lease & Billing</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Lease Summary & Deposit */}
        {step === 3 && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: 18 }}>
              <h4 style={{ fontSize: 14, fontWeight: 900, color: "#000000", margin: "0 0 12px" }}>
                Lease Agreement Summary
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div><span style={{ color: "#64748b" }}>Tenant Name:</span> <strong style={{ color: "#000000" }}>{formData.tenantName || "John Doe"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Assigned Unit:</span> <strong style={{ color: "#000000" }}>{formData.unitCode}</strong></div>
                <div><span style={{ color: "#64748b" }}>Monthly Rent:</span> <strong style={{ color: "#000000" }}>KES {formData.monthlyRent.toLocaleString()}</strong></div>
                <div><span style={{ color: "#64748b" }}>Security Deposit:</span> <strong style={{ color: "#000000" }}>KES {formData.deposit.toLocaleString()}</strong></div>
                <div><span style={{ color: "#64748b" }}>Commencement:</span> <strong style={{ color: "#000000" }}>{formData.startDate}</strong></div>
                <div><span style={{ color: "#64748b" }}>Lease Term:</span> <strong style={{ color: "#000000" }}>{formData.leaseMonths} Months</strong></div>
              </div>

              <div style={{ borderTop: "1px solid #cbd5e1", marginTop: 14, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#000000" }}>Initial Payable Total:</span>
                <strong style={{ fontSize: 18, fontWeight: 900, color: "#dc2626" }}>
                  KES {(formData.monthlyRent + formData.deposit).toLocaleString()}
                </strong>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#000000" }}>
              <input
                type="checkbox"
                checked={formData.autoInvoice}
                onChange={(e) => setFormData({ ...formData, autoInvoice: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "#dc2626" }}
              />
              <span>Auto-generate initial rent invoice & dispatch welcome receipt</span>
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button type="button" onClick={() => setStep(2)} style={{ background: "#f1f5f9", border: 0, color: "#0f172a", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmit}
                style={{ background: "#16a34a", border: 0, color: "#ffffff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <ShieldCheck size={18} />
                <span>{submitting ? "Processing Onboarding…" : "Complete Tenant Onboarding"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
