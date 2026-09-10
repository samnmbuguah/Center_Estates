"use client";

import { useState, useMemo } from "react";
import {
  Modal, Field, StatusPill, Badge, Panel, EmptyState, LoadingState, money,
} from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import {
  Building2, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  DollarSign, Landmark, Users, Plus, Trash2, Edit3, HelpCircle, Layers,
  CreditCard, Sparkles, RefreshCw, KeyRound, Check, FileText
} from "lucide-react";

interface BlockItem {
  name: string;
  floors: number;
}

interface OwnerItem {
  id?: string;
  name: string;
  email: string;
  phone: string;
  pin_number: string;
  id_or_registration_number: string;
  settlement_bank_name: string;
  settlement_bank_account: string;
  settlement_bank_branch: string;
  settlement_paybill_or_till: string;
  notes: string;
}

interface UnitItem {
  code: string;
  block: string;
  floor: string;
  area: string;
  sectional_title_number: string;
  ownership_share: string;
  owner_name: string;
  management_mandate: "both" | "rental_management" | "common_area_only" | "none";
  service_charge_payer: "owner" | "tenant";
  water_payer: "tenant" | "owner";
  rental_commission_rate: string;
  common_area_fee_amount: string;
  letting_fee_amount: string;
  // Optional tenant details
  tenant_name?: string;
  monthly_rent?: string;
  lease_starts_on?: string;
  lease_ends_on?: string;
}

interface CollectionAccountItem {
  charge_type: "rent" | "service_charge" | "water" | "management_fee";
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string;
  mpesa_paybill: string;
  mpesa_reference_format: string;
}

interface FeeProfileItem {
  fee_type: "common_area_fee" | "rental_commission" | "letting_fee" | "other";
  calculation_basis: "fixed" | "percentage" | "area_rate";
  amount: string;
  percentage_rate: string;
  billing_frequency: string;
  billed_to: "unit_owner" | "tenant" | "manager";
  vat_applicable: boolean;
  vat_rate: string;
}

const STEPS = [
  { id: 1, title: "Property Profile", icon: Building2 },
  { id: 2, title: "Scheme & Blocks", icon: Layers },
  { id: 3, title: "Units Register", icon: KeyRound },
  { id: 4, title: "Landlords & Owners", icon: Users },
  { id: 5, title: "Mandates & Fees", icon: DollarSign },
  { id: 6, title: "Tenants & Leases", icon: FileText },
  { id: 7, title: "Services Provided", icon: ShieldCheck },
  { id: 8, title: "Billing Rules", icon: CreditCard },
  { id: 9, title: "Collection Accounts", icon: Landmark },
  { id: 10, title: "M-Pesa Setup", icon: Sparkles },
  { id: 11, title: "Settlement Rules", icon: RefreshCw },
  { id: 12, title: "Review & Activate", icon: CheckCircle2 },
];

const STANDARD_SERVICES = [
  "24/7 Manned Security & Guarding",
  "Common Area Cleaning & Housekeeping",
  "Garbage Collection & Waste Disposal",
  "High-Speed Lift Maintenance",
  "Standby Generator & Fuel Maintenance",
  "Water Pumping & Borehole Treatment",
  "CCTV & Access Control Monitoring",
  "Swimming Pool Maintenance",
  "Gym & Fitness Center Oversight",
  "Landscape & Grounds Maintenance",
  "Pest Control & Fumigation",
  "Fire Safety Systems & Extinguishers",
];

export function SectionalTitleOnboardingModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Property Profile
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propCity, setPropCity] = useState("Nairobi");
  const [estateManager, setEstateManager] = useState("");
  const [commencementDate, setCommencementDate] = useState(new Date().toISOString().slice(0, 10));

  // Step 2: Scheme & Blocks
  const [schemeNumber, setSchemeNumber] = useState("");
  const [blocks, setBlocks] = useState<BlockItem[]>([
    { name: "Block A", floors: 4 },
    { name: "Block B", floors: 4 },
  ]);

  // Step 3 & 4: Units & Owners
  const [owners, setOwners] = useState<OwnerItem[]>([
    {
      name: "Dr. James Kariuki",
      email: "jkariuki@example.com",
      phone: "+254711223344",
      pin_number: "A001234567Z",
      id_or_registration_number: "22334455",
      settlement_bank_name: "KCB Bank",
      settlement_bank_account: "1234567890",
      settlement_bank_branch: "Kilimani",
      settlement_paybill_or_till: "",
      notes: "Preferred payout by 5th of month",
    },
  ]);

  const [units, setUnits] = useState<UnitItem[]>([
    {
      code: "A101",
      block: "Block A",
      floor: "1",
      area: "1200",
      sectional_title_number: "ST/A101/2026",
      ownership_share: "0.2500",
      owner_name: "Dr. James Kariuki",
      management_mandate: "both",
      service_charge_payer: "owner",
      water_payer: "tenant",
      rental_commission_rate: "10.00",
      common_area_fee_amount: "5000.00",
      letting_fee_amount: "0.00",
      tenant_name: "David Otieno",
      monthly_rent: "45000",
      lease_starts_on: "2026-01-01",
      lease_ends_on: "2026-12-31",
    },
  ]);

  // Step 7: Services
  const [selectedServices, setSelectedServices] = useState<string[]>([
    "24/7 Manned Security & Guarding",
    "Common Area Cleaning & Housekeeping",
    "Garbage Collection & Waste Disposal",
    "Standby Generator & Fuel Maintenance",
    "CCTV & Access Control Monitoring",
  ]);

  // Step 8: Default Fee Profiles
  const [feeProfiles, setFeeProfiles] = useState<FeeProfileItem[]>([
    {
      fee_type: "common_area_fee",
      calculation_basis: "fixed",
      amount: "5000.00",
      percentage_rate: "0.00",
      billing_frequency: "monthly",
      billed_to: "unit_owner",
      vat_applicable: true,
      vat_rate: "16.00",
    },
    {
      fee_type: "rental_commission",
      calculation_basis: "percentage",
      amount: "0.00",
      percentage_rate: "10.00",
      billing_frequency: "monthly",
      billed_to: "unit_owner",
      vat_applicable: true,
      vat_rate: "16.00",
    },
  ]);

  // Step 9 & 10: Collection Accounts
  const [collectionAccounts, setCollectionAccounts] = useState<CollectionAccountItem[]>([
    {
      charge_type: "rent",
      bank_name: "NCBA Bank",
      account_name: "Rent Collection Account",
      account_number: "1122334455",
      branch: "Kilimani",
      mpesa_paybill: "522522",
      mpesa_reference_format: "RENT-{UNIT}-{MONTH}-{YEAR}",
    },
    {
      charge_type: "service_charge",
      bank_name: "NCBA Bank",
      account_name: "Service Charge Account",
      account_number: "1122334466",
      branch: "Kilimani",
      mpesa_paybill: "522522",
      mpesa_reference_format: "SC-{UNIT}-{MONTH}-{YEAR}",
    },
    {
      charge_type: "water",
      bank_name: "NCBA Bank",
      account_name: "Water Utility Account",
      account_number: "1122334477",
      branch: "Kilimani",
      mpesa_paybill: "522522",
      mpesa_reference_format: "WATER-{UNIT}-{MONTH}-{YEAR}",
    },
    {
      charge_type: "management_fee",
      bank_name: "NCBA Bank",
      account_name: "Management Fees Collection",
      account_number: "1122334488",
      branch: "Kilimani",
      mpesa_paybill: "522522",
      mpesa_reference_format: "MF-{UNIT}-{MONTH}-{YEAR}",
    },
  ]);

  // Bulk Generator State for quick unit population
  const [quickBlock, setQuickBlock] = useState("Block A");
  const [quickPrefix, setQuickPrefix] = useState("A");
  const [quickStart, setQuickStart] = useState(101);
  const [quickCount, setQuickCount] = useState(4);
  const [quickOwner, setQuickOwner] = useState("");
  const [quickMandate, setQuickMandate] = useState<"both" | "rental_management" | "common_area_only" | "none">("both");
  const [quickRent, setQuickRent] = useState("45000");

  const handleBulkAddUnits = () => {
    const newUnits: UnitItem[] = [];
    for (let i = 0; i < quickCount; i++) {
      const code = `${quickPrefix}${quickStart + i}`;
      newUnits.push({
        code,
        block: quickBlock,
        floor: String(Math.floor((quickStart + i) / 100) || 1),
        area: "1200",
        sectional_title_number: `ST/${code}/2026`,
        ownership_share: (1 / (units.length + quickCount)).toFixed(4),
        owner_name: quickOwner || (owners[0]?.name ?? ""),
        management_mandate: quickMandate,
        service_charge_payer: "owner",
        water_payer: "tenant",
        rental_commission_rate: "10.00",
        common_area_fee_amount: "5000.00",
        letting_fee_amount: "0.00",
        monthly_rent: quickRent,
      });
    }
    setUnits((prev) => [...prev, ...newUnits]);
  };

  const handleAddOwner = () => {
    setOwners((prev) => [
      ...prev,
      {
        name: `Landlord ${prev.length + 1}`,
        email: "",
        phone: "",
        pin_number: "",
        id_or_registration_number: "",
        settlement_bank_name: "NCBA Bank",
        settlement_bank_account: "",
        settlement_bank_branch: "",
        settlement_paybill_or_till: "",
        notes: "",
      },
    ]);
  };

  const handleAddBlock = () => {
    setBlocks((prev) => [
      ...prev,
      { name: `Block ${String.fromCharCode(65 + prev.length)}`, floors: 4 },
    ]);
  };

  // Readiness checklist calculations
  const readiness = useMemo(() => {
    const checks = [
      {
        title: "Property & Sectional Scheme Registration",
        passed: Boolean(propName.trim() && schemeNumber.trim()),
        detail: schemeNumber ? `Scheme: ${schemeNumber}` : "Scheme registration number required",
      },
      {
        title: "Units Registered & Configured",
        passed: units.length > 0,
        detail: `${units.length} unit(s) created across ${blocks.length} block(s)`,
      },
      {
        title: "Landlords / Owners Assigned",
        passed: units.length > 0 && units.every((u) => u.owner_name.trim() !== ""),
        detail: owners.length > 0 ? `${owners.length} registered owner(s)` : "Assign owners to all units",
      },
      {
        title: "Collection Accounts Configured",
        passed: collectionAccounts.some((a) => a.charge_type === "rent") && collectionAccounts.some((a) => a.charge_type === "service_charge"),
        detail: `${collectionAccounts.length} dedicated collection channel(s)`,
      },
      {
        title: "Managed Units Settlement Details",
        passed: units
          .filter((u) => u.management_mandate === "rental_management" || u.management_mandate === "both")
          .every((u) => {
            const owner = owners.find((o) => o.name === u.owner_name);
            return owner && (owner.settlement_bank_account || owner.settlement_paybill_or_till);
          }),
        detail: "All rental-managed unit owners have settlement bank or paybill payout routes",
      },
    ];
    const isReady = checks.every((c) => c.passed);
    return { checks, isReady };
  }, [propName, schemeNumber, units, blocks, owners, collectionAccounts]);

  const handleSubmitOnboarding = async () => {
    setError("");
    setLoading(true);
    try {
      const payload = {
        property: {
          name: propName,
          scheme_registration_number: schemeNumber,
          total_blocks: blocks.length,
          total_units_count: units.length,
          estate_manager_name: estateManager,
          management_commencement_date: commencementDate,
          address: propAddress,
          city: propCity,
        },
        blocks: blocks.map((b) => ({ name: b.name, floors: b.floors })),
        owners: owners.map((o) => ({
          name: o.name,
          email: o.email,
          phone: o.phone,
          pin_number: o.pin_number,
          id_or_registration_number: o.id_or_registration_number,
          settlement_bank_name: o.settlement_bank_name,
          settlement_bank_account: o.settlement_bank_account,
          settlement_bank_branch: o.settlement_bank_branch,
          settlement_paybill_or_till: o.settlement_paybill_or_till,
          notes: o.notes,
        })),
        units: units.map((u) => ({
          code: u.code,
          block: u.block,
          floor: u.floor,
          area: u.area || null,
          sectional_title_number: u.sectional_title_number,
          ownership_share: u.ownership_share || "1.0000",
          owner_name: u.owner_name,
          management_mandate: u.management_mandate,
          service_charge_payer: u.service_charge_payer,
          water_payer: u.water_payer,
          rental_commission_rate: u.rental_commission_rate || "10.00",
          common_area_fee_amount: u.common_area_fee_amount || "0.00",
          letting_fee_amount: u.letting_fee_amount || "0.00",
        })),
        fee_profiles: feeProfiles,
        collection_accounts: collectionAccounts,
        activate_immediately: true,
      };

      const res = await apiFetch("/property/properties/onboard-sectional-title/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfFromCookie(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = await apiErrorMessage(errJson, "Failed to complete Sectional Title onboarding.");
        throw new Error(msg);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to complete Sectional Title onboarding.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      maxWidth="xl"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            background: "linear-gradient(135deg, var(--color-indigo-strong) 0%, var(--color-indigo) 100%)",
            color: "#fff",
            borderRadius: 8,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
          }}>
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Sectional Title Property Onboarding</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Multi-Landlord Unit Allocation, Per-Unit Mandates & Charge-Specific Collection Flow
            </div>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 12-Step Progress Indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          padding: "10px 4px",
          borderBottom: "1px solid var(--border)",
        }}>
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: isCurrent ? 600 : 500,
                  border: isCurrent ? "1px solid var(--color-indigo-strong)" : "1px solid transparent",
                  background: isCurrent ? "rgba(99, 102, 241, 0.12)" : (isCompleted ? "var(--surface-active, rgba(255,255,255,0.05))" : "transparent"),
                  color: isCurrent ? "var(--color-indigo-300)" : (isCompleted ? "var(--text-main)" : "var(--muted)"),
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: isCurrent ? "var(--color-indigo-strong)" : (isCompleted ? "var(--color-emerald)" : "var(--border)"),
                  color: "#fff",
                }}>
                  {isCompleted ? <Check size={12} /> : s.id}
                </div>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Property Profile */}
        {currentStep === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Define the master estate or complex profile under Sectional Properties Act management.
            </div>
            <div className="grid-2">
              <Field label="Property / Estate Name" required>
                <input
                  value={propName}
                  onChange={(e) => setPropName(e.target.value)}
                  placeholder="e.g. Kilimani Heights Apartments"
                  required
                />
              </Field>
              <Field label="Estate / Scheme Manager" required>
                <input
                  value={estateManager}
                  onChange={(e) => setEstateManager(e.target.value)}
                  placeholder="e.g. Mary Wanjiku"
                  required
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Physical Address">
                <input
                  value={propAddress}
                  onChange={(e) => setPropAddress(e.target.value)}
                  placeholder="e.g. Argwings Kodhek Road, Kilimani"
                />
              </Field>
              <Field label="City / Municipality">
                <input
                  value={propCity}
                  onChange={(e) => setPropCity(e.target.value)}
                  placeholder="e.g. Nairobi"
                />
              </Field>
            </div>
            <Field label="Management Commencement Date" required>
              <input
                type="date"
                value={commencementDate}
                onChange={(e) => setCommencementDate(e.target.value)}
                required
              />
            </Field>
          </div>
        )}

        {/* Step 2: Scheme & Blocks */}
        {currentStep === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Register the Sectional Title Scheme registration number and configured residential/commercial blocks.
            </div>
            <div className="grid-2">
              <Field label="Sectional Scheme Registration No." required>
                <input
                  value={schemeNumber}
                  onChange={(e) => setSchemeNumber(e.target.value)}
                  placeholder="e.g. SS/NAI/2026/089"
                  required
                />
              </Field>
              <Field label="Total Scheme Units Count">
                <input
                  type="number"
                  value={units.length}
                  disabled
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </Field>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Estate Blocks / Buildings</div>
                <button type="button" className="btn ghost sm" onClick={handleAddBlock}>
                  <Plus size={14} style={{ marginRight: 4 }} /> Add Block
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {blocks.map((b, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}>
                    <Layers size={16} color="var(--color-indigo-300)" />
                    <input
                      value={b.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBlocks((prev) => prev.map((item, idx) => idx === i ? { ...item, name: val } : item));
                      }}
                      placeholder="Block Name"
                      style={{ flex: 2 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Floors:</span>
                      <input
                        type="number"
                        value={b.floors}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setBlocks((prev) => prev.map((item, idx) => idx === i ? { ...item, floors: val } : item));
                        }}
                        style={{ width: 70 }}
                      />
                    </div>
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        className="btn ghost sm text-danger"
                        onClick={() => setBlocks((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Units Setup */}
        {currentStep === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Quick Bulk Generator Banner */}
            <div style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, color: "var(--color-indigo-300)" }}>
                <Sparkles size={16} /> Quick Bulk Unit Generator
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                <Field label="Block">
                  <select value={quickBlock} onChange={(e) => setQuickBlock(e.target.value)}>
                    {blocks.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Prefix">
                  <input value={quickPrefix} onChange={(e) => setQuickPrefix(e.target.value)} />
                </Field>
                <Field label="Start No.">
                  <input type="number" value={quickStart} onChange={(e) => setQuickStart(parseInt(e.target.value, 10) || 101)} />
                </Field>
                <Field label="Count">
                  <input type="number" value={quickCount} onChange={(e) => setQuickCount(parseInt(e.target.value, 10) || 1)} />
                </Field>
                <Field label="Assign Owner">
                  <select value={quickOwner} onChange={(e) => setQuickOwner(e.target.value)}>
                    <option value="">Select Landlord...</option>
                    {owners.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button type="button" className="btn primary sm" onClick={handleBulkAddUnits} style={{ width: "100%", height: 38 }}>
                    + Generate Units
                  </button>
                </div>
              </div>
            </div>

            {/* Units Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Unit Code</th>
                    <th>Block</th>
                    <th>Floor</th>
                    <th>Area (sqft)</th>
                    <th>Sectional Title No.</th>
                    <th>Landlord / Owner</th>
                    <th>Share Ratio</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={u.code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, code: val } : it));
                          }}
                          style={{ width: 80, padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <select
                          value={u.block}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, block: val } : it));
                          }}
                          style={{ padding: "4px 6px" }}
                        >
                          {blocks.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          value={u.floor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, floor: val } : it));
                          }}
                          style={{ width: 50, padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={u.area}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, area: val } : it));
                          }}
                          style={{ width: 80, padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={u.sectional_title_number}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, sectional_title_number: val } : it));
                          }}
                          style={{ width: 130, padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <select
                          value={u.owner_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, owner_name: val } : it));
                          }}
                          style={{ padding: "4px 6px" }}
                        >
                          <option value="">Select Landlord...</option>
                          {owners.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          value={u.ownership_share}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, ownership_share: val } : it));
                          }}
                          style={{ width: 70, padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost sm text-danger"
                          onClick={() => setUnits((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Landlords / Owners */}
        {currentStep === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--muted)" }}>
                Manage unit title-holders, tax compliance PINs, and automated payout settlement accounts.
              </div>
              <button type="button" className="btn primary sm" onClick={handleAddOwner}>
                <Plus size={14} style={{ marginRight: 4 }} /> Add Landlord / Owner
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {owners.map((o, i) => (
                <div key={i} style={{
                  padding: "16px",
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      <Users size={16} color="var(--color-indigo-300)" />
                      <span>{o.name || `Owner ${i + 1}`}</span>
                    </div>
                    {owners.length > 1 && (
                      <button
                        type="button"
                        className="btn ghost sm text-danger"
                        onClick={() => setOwners((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 size={14} /> Remove Owner
                      </button>
                    )}
                  </div>

                  <div className="grid-3">
                    <Field label="Full Name / Entity Name" required>
                      <input
                        value={o.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, name: val } : item));
                        }}
                        placeholder="e.g. Dr. James Kariuki"
                        required
                      />
                    </Field>
                    <Field label="National ID / Registration No.">
                      <input
                        value={o.id_or_registration_number}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, id_or_registration_number: val } : item));
                        }}
                        placeholder="e.g. 22334455"
                      />
                    </Field>
                    <Field label="KRA PIN Number">
                      <input
                        value={o.pin_number}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, pin_number: val } : item));
                        }}
                        placeholder="e.g. A001234567Z"
                      />
                    </Field>
                  </div>

                  <div className="grid-2">
                    <Field label="Email Address">
                      <input
                        type="email"
                        value={o.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, email: val } : item));
                        }}
                        placeholder="e.g. jkariuki@example.com"
                      />
                    </Field>
                    <Field label="Phone Number">
                      <input
                        value={o.phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, phone: val } : item));
                        }}
                        placeholder="e.g. +254711223344"
                      />
                    </Field>
                  </div>

                  {/* Settlement Bank Details */}
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px dashed var(--border)",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-indigo-300)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Landmark size={14} /> Settlement / Payout Destination
                    </div>
                    <div className="grid-3">
                      <Field label="Settlement Bank Name">
                        <input
                          value={o.settlement_bank_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, settlement_bank_name: val } : item));
                          }}
                          placeholder="e.g. KCB / NCBA"
                        />
                      </Field>
                      <Field label="Bank Account Number">
                        <input
                          value={o.settlement_bank_account}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, settlement_bank_account: val } : item));
                          }}
                          placeholder="e.g. 1234567890"
                        />
                      </Field>
                      <Field label="Bank Branch / Paybill">
                        <input
                          value={o.settlement_bank_branch}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOwners((prev) => prev.map((item, idx) => idx === i ? { ...item, settlement_bank_branch: val } : item));
                          }}
                          placeholder="e.g. Kilimani Branch"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Management Mandates & Fees */}
        {currentStep === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Assign management mandates and commission percentages per unit.
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Landlord</th>
                    <th>Management Mandate</th>
                    <th>Rental Comm. (%)</th>
                    <th>Common Area Fee</th>
                    <th>Service Charge Payer</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={i}>
                      <td><span style={{ fontWeight: 600 }}>{u.code}</span></td>
                      <td>{u.owner_name || "—"}</td>
                      <td>
                        <select
                          value={u.management_mandate}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, management_mandate: val } : it));
                          }}
                          style={{ padding: "4px 8px", borderRadius: 6 }}
                        >
                          <option value="both">Both (Rental + Common Area)</option>
                          <option value="rental_management">Rental Management Only</option>
                          <option value="common_area_only">Common Area Only</option>
                          <option value="none">Self Managed / None</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={u.rental_commission_rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, rental_commission_rate: val } : it));
                          }}
                          disabled={u.management_mandate === "common_area_only" || u.management_mandate === "none"}
                          style={{ width: 70, padding: "4px 6px" }}
                        />
                        <span style={{ marginLeft: 4 }}>%</span>
                      </td>
                      <td>
                        <input
                          value={u.common_area_fee_amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, common_area_fee_amount: val } : it));
                          }}
                          style={{ width: 85, padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <select
                          value={u.service_charge_payer}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, service_charge_payer: val } : it));
                          }}
                          style={{ padding: "4px 8px" }}
                        >
                          <option value="owner">Unit Landlord / Owner</option>
                          <option value="tenant">Occupying Tenant</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 6: Tenants & Leases */}
        {currentStep === 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Capture active tenants and monthly rental agreements for units under rental management.
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Mandate</th>
                    <th>Tenant Name</th>
                    <th>Monthly Rent (KES)</th>
                    <th>Lease Starts</th>
                    <th>Lease Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={i}>
                      <td><span style={{ fontWeight: 600 }}>{u.code}</span></td>
                      <td>
                        <StatusPill
                          value={u.management_mandate === "both" || u.management_mandate === "rental_management" ? "active" : "draft"}
                        />
                      </td>
                      <td>
                        <input
                          value={u.tenant_name ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, tenant_name: val } : it));
                          }}
                          placeholder="Tenant full name..."
                          disabled={u.management_mandate === "common_area_only" || u.management_mandate === "none"}
                          style={{ padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={u.monthly_rent ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, monthly_rent: val } : it));
                          }}
                          placeholder="e.g. 45000"
                          disabled={u.management_mandate === "common_area_only" || u.management_mandate === "none"}
                          style={{ width: 100, padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={u.lease_starts_on ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, lease_starts_on: val } : it));
                          }}
                          disabled={u.management_mandate === "common_area_only" || u.management_mandate === "none"}
                          style={{ padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={u.lease_ends_on ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUnits((prev) => prev.map((it, idx) => idx === i ? { ...it, lease_ends_on: val } : it));
                          }}
                          disabled={u.management_mandate === "common_area_only" || u.management_mandate === "none"}
                          style={{ padding: "4px 6px" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 7: Services Provided */}
        {currentStep === 7 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Select common area and facility services maintained by the estate management team.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {STANDARD_SERVICES.map((srv) => {
                const isSelected = selectedServices.includes(srv);
                return (
                  <div
                    key={srv}
                    onClick={() => {
                      setSelectedServices((prev) =>
                        isSelected ? prev.filter((s) => s !== srv) : [...prev, srv]
                      );
                    }}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: isSelected ? "rgba(99, 102, 241, 0.12)" : "var(--surface)",
                      border: isSelected ? "1px solid var(--color-indigo-strong)" : "1px solid var(--border)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>{srv}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 8: Billing Rules */}
        {currentStep === 8 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Configure recurring fee structures and tax configurations.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {feeProfiles.map((fp, idx) => (
                <div key={idx} style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-indigo-300)" }}>
                    {fp.fee_type === "common_area_fee" ? "Common Area Management Fee" : "Rental Management Commission"}
                  </div>
                  <div className="grid-3">
                    <Field label="Calculation Basis">
                      <select
                        value={fp.calculation_basis}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setFeeProfiles((prev) => prev.map((item, i) => i === idx ? { ...item, calculation_basis: val } : item));
                        }}
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="percentage">Percentage Rate (%)</option>
                        <option value="area_rate">Rate Per Area</option>
                      </select>
                    </Field>
                    <Field label={fp.calculation_basis === "percentage" ? "Rate (%)" : "Amount (KES)"}>
                      <input
                        value={fp.calculation_basis === "percentage" ? fp.percentage_rate : fp.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFeeProfiles((prev) => prev.map((item, i) => i === idx ? (
                            fp.calculation_basis === "percentage" ? { ...item, percentage_rate: val } : { ...item, amount: val }
                          ) : item));
                        }}
                      />
                    </Field>
                    <Field label="Billed To">
                      <select
                        value={fp.billed_to}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setFeeProfiles((prev) => prev.map((item, i) => i === idx ? { ...item, billed_to: val } : item));
                        }}
                      >
                        <option value="unit_owner">Unit Landlord / Owner</option>
                        <option value="tenant">Occupying Tenant</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 9 & 10: Collection Accounts & M-Pesa Setup */}
        {(currentStep === 9 || currentStep === 10) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              {currentStep === 9
                ? "Configure separated bank collection accounts per charge category to ensure complete ledger segregation."
                : "Set up M-Pesa Paybill / Till Numbers and dynamic reference formats per charge stream."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {collectionAccounts.map((ca, idx) => (
                <div key={idx} style={{
                  padding: "16px",
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      <Landmark size={16} color="var(--color-indigo-300)" />
                      <span style={{ textTransform: "capitalize" }}>{ca.charge_type.replace("_", " ")} Collection Stream</span>
                    </div>
                    <span className="badge badge-purple">{ca.charge_type.toUpperCase()}</span>
                  </div>

                  <div className="grid-3">
                    <Field label="Bank Name">
                      <input
                        value={ca.bank_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionAccounts((prev) => prev.map((item, i) => i === idx ? { ...item, bank_name: val } : item));
                        }}
                        placeholder="e.g. NCBA Bank"
                      />
                    </Field>
                    <Field label="Account Name">
                      <input
                        value={ca.account_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionAccounts((prev) => prev.map((item, i) => i === idx ? { ...item, account_name: val } : item));
                        }}
                        placeholder="e.g. Kilimani SC Collection"
                      />
                    </Field>
                    <Field label="Account Number">
                      <input
                        value={ca.account_number}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionAccounts((prev) => prev.map((item, i) => i === idx ? { ...item, account_number: val } : item));
                        }}
                        placeholder="e.g. 1122334455"
                      />
                    </Field>
                  </div>

                  <div className="grid-2">
                    <Field label="M-Pesa Paybill / Till">
                      <input
                        value={ca.mpesa_paybill}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionAccounts((prev) => prev.map((item, i) => i === idx ? { ...item, mpesa_paybill: val } : item));
                        }}
                        placeholder="e.g. 522522"
                      />
                    </Field>
                    <Field label="Account Reference Pattern">
                      <input
                        value={ca.mpesa_reference_format}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionAccounts((prev) => prev.map((item, i) => i === idx ? { ...item, mpesa_reference_format: val } : item));
                        }}
                        placeholder="{CHARGE}-{UNIT}-{MONTH}-{YEAR}"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 11: Settlement Rules */}
        {currentStep === 11 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              Review landlord remittance schedule and automated commission deduction rules.
            </div>

            <div style={{
              padding: "16px",
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#34d399", display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> Automated Net Landlord Remittance Rules
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-main)" }}>
                • When a tenant makes a rent payment, funds land into the dedicated <strong>Rent Collection Account</strong>.<br />
                • The platform automatically calculates the manager’s agreed commission % (e.g. 10.00% + 16% VAT).<br />
                • Net rental proceeds are scheduled for direct EFT / RTGS / Pesalink transfer to the unit owner’s settlement bank account on the 5th of each month.<br />
                • Monthly Landlord Remittance Statements are generated automatically and published to the Owner Portal.
              </div>
            </div>
          </div>
        )}

        {/* Step 12: Review & Activate */}
        {currentStep === 12 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Visual Financial Flow Diagram */}
            <div style={{
              padding: "18px 20px",
              borderRadius: 12,
              background: "radial-gradient(ellipse at top, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} /> Visual Financial Flows & Segregated Accounts
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {/* Rent Flow */}
                <div style={{
                  padding: "12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: 6 }}>1. Rent Flow</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                    <span>Tenant</span> <ArrowRight size={12} /> <span>Rent A/C</span> <ArrowRight size={12} /> <span>Owner Payout</span>
                  </div>
                </div>

                {/* Service Charge Flow */}
                <div style={{
                  padding: "12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 600, color: "#34d399", marginBottom: 6 }}>2. Service Charge Flow</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                    <span>Owner / Landlord</span> <ArrowRight size={12} /> <span>Service Charge A/C</span>
                  </div>
                </div>

                {/* Water Utility Flow */}
                <div style={{
                  padding: "12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 600, color: "var(--color-amber-400)", marginBottom: 6 }}>3. Water Utility Flow</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                    <span>Tenant Meter</span> <ArrowRight size={12} /> <span>Water Collection A/C</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Readiness Checklist */}
            <div style={{
              padding: "16px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Onboarding Readiness & Validation</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readiness.checks.map((chk, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {chk.passed ? <CheckCircle2 size={16} color="var(--color-emerald)" /> : <AlertCircle size={16} color="#f87171" />}
                      <span>{chk.title}</span>
                    </div>
                    <span style={{ color: "var(--muted)" }}>{chk.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
        }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => currentStep > 1 ? setCurrentStep((s) => s - 1) : onClose()}
            disabled={loading}
          >
            <ArrowLeft size={14} style={{ marginRight: 6 }} />
            {currentStep > 1 ? "Previous Step" : "Cancel"}
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            {currentStep < 12 ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next Step <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </button>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={loading || !readiness.isReady}
                onClick={handleSubmitOnboarding}
                style={{
                  background: readiness.isReady ? "linear-gradient(135deg, var(--color-emerald) 0%, var(--color-emerald-strong) 100%)" : undefined,
                  boxShadow: readiness.isReady ? "0 4px 12px rgba(16, 185, 129, 0.3)" : undefined,
                }}
              >
                {loading ? "Activating Scheme..." : "Activate & Onboard Property"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
