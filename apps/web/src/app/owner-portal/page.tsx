"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import {
  Building2,
  DollarSign,
  Landmark,
  FileText,
  Users,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Printer,
  ChevronRight,
  TrendingUp,
  Receipt,
  Download,
} from "lucide-react";

type Owner = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  pin_number: string;
  id_or_registration_number: string;
  settlement_bank_name: string;
  settlement_bank_account: string;
  settlement_bank_branch: string;
  settlement_paybill_or_till: string;
  engaged_for_unit_management: boolean;
  engaged_for_letting: boolean;
  units_count?: number;
  units?: any[];
  units_list?: any[];
};

type FinancialSummary = {
  owner_id: string;
  owner_name: string;
  owner_code: string;
  units_count: number;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  active_rent_roll: number;
  settlement_details: {
    bank_name: string;
    account_number: string;
    branch: string;
    paybill: string;
  };
};

type Tab = "overview" | "units" | "remittances" | "ledger" | "settlement";

const cash = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export default function OwnerPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

  const [owners, setOwners] = useState<Owner[]>([]);
  const [activeOwner, setActiveOwner] = useState<Owner | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Remittance state
  const now = new Date();
  const [remittancePeriod, setRemittancePeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [remittanceData, setRemittanceData] = useState<any>(null);
  const [remittanceLoading, setRemittanceLoading] = useState(false);

  // Load owners and identify target owner
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/property/owners/", {}, organizationId);
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Could not load owner portfolio."));
      }
      const data = await res.json();
      const list: Owner[] = Array.isArray(data) ? data : (data.results || []);
      setOwners(list);

      // Check query param
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("owner");
      const matched = requestedId ? list.find((o) => o.id === requestedId) : list[0];
      if (matched) {
        setActiveOwner(matched);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Unit Owner Portal.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load owner details when activeOwner changes
  useEffect(() => {
    if (!activeOwner) return;

    async function loadOwnerDetails() {
      try {
        const [sumRes, unitsRes] = await Promise.all([
          apiFetch(`/property/owners/${activeOwner?.id}/financial-summary/`, {}, organizationId),
          apiFetch(`/property/units/?owner=${activeOwner?.id}`, {}, organizationId),
        ]);

        if (sumRes.ok) {
          setFinancialSummary(await sumRes.json());
        }
        if (unitsRes.ok) {
          const uData = await unitsRes.json();
          setUnits(Array.isArray(uData) ? uData : (uData.results || []));
        } else if (activeOwner?.units) {
          setUnits(activeOwner.units);
        }
      } catch {
        // Fallback gracefully
      }
    }

    loadOwnerDetails();
  }, [activeOwner, organizationId]);

  // Fetch remittance statement
  const fetchRemittance = useCallback(async () => {
    if (!activeOwner) return;
    setRemittanceLoading(true);
    try {
      const res = await apiFetch(
        `/property/owners/${activeOwner.id}/remittance-statement/?month=${remittancePeriod.month}&year=${remittancePeriod.year}`,
        {},
        organizationId
      );
      if (res.ok) {
        setRemittanceData(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setRemittanceLoading(false);
    }
  }, [activeOwner, remittancePeriod, organizationId]);

  useEffect(() => {
    if (activeTab === "remittances") {
      fetchRemittance();
    }
  }, [activeTab, fetchRemittance]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Loading Unit Owner Portal…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "var(--font-sans, sans-serif)" }}>
      {/* Top Banner & Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 18,
                boxShadow: "0 2px 6px rgba(37,99,235,0.3)",
              }}
            >
              👑
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2563eb" }}>
                  Unit Owner & Landlord Portal
                </span>
                <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  Live Ledger
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {activeOwner?.name ?? "Landlord Portfolio"}
              </h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {owners.length > 1 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569" }}>
                Switch Owner:
                <select
                  value={activeOwner?.id ?? ""}
                  onChange={(e) => {
                    const found = owners.find((o) => o.id === e.target.value);
                    if (found) {
                      setActiveOwner(found);
                      const url = new URL(window.location.href);
                      url.searchParams.set("owner", found.id);
                      window.history.replaceState({}, "", url.toString());
                    }
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                borderRadius: 8,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Pills */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10 }}>
            {[
              { id: "overview", label: "Portfolio Overview", icon: "📊" },
              { id: "units", label: `Managed Units (${units.length || activeOwner?.units_count || 0})`, icon: "🏢" },
              { id: "remittances", label: "Remittance Statements", icon: "📑" },
              { id: "settlement", label: "Bank & Payout Setup", icon: "🏦" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as Tab)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#1d4ed8" : "#475569",
                    background: active ? "#eff6ff" : "transparent",
                    border: active ? "1px solid #bfdbfe" : "1px solid transparent",
                    boxShadow: active ? "0 1px 2px rgba(37,99,235,0.06)" : "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 20px 48px" }}>
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Header KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Managed Units</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontSize: 14 }}>🏢</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              {units.length || activeOwner?.units_count || 0}
            </div>
            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 4 }}>
              ● 100% Assigned to Owner
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Contracted Rent Roll</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "grid", placeItems: "center", fontSize: 14 }}>💰</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              {cash.format(financialSummary?.active_rent_roll ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Active monthly lease commitments
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Total Collections Paid</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#f0fdf4", color: "#16a34a", display: "grid", placeItems: "center", fontSize: 14 }}>📈</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>
              {cash.format(financialSummary?.total_paid ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Receipted funds in active accounting cycle
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Outstanding Rent Arrears</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#fef2f2", color: "#dc2626", display: "grid", placeItems: "center", fontSize: 14 }}>⚠️</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: (financialSummary?.outstanding_balance ?? 0) > 0 ? "#dc2626" : "#0f172a" }}>
              {cash.format(financialSummary?.outstanding_balance ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Uncollected balances under recovery
            </div>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            {/* Left: Units Quick Summary */}
            <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Portfolio Units & Occupancy</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Live status of your registered property units</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("units")}
                  style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "none", border: 0, cursor: "pointer" }}
                >
                  View all units →
                </button>
              </div>

              {units.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  No units linked to this owner profile yet. Contact property management to allocate units.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                        <th style={{ padding: "10px 12px" }}>Unit Code</th>
                        <th style={{ padding: "10px 12px" }}>Property</th>
                        <th style={{ padding: "10px 12px" }}>Status</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>Monthly Rent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.slice(0, 5).map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{u.code || u.name}</td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{u.property_name || "Main Property"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: u.is_occupied ?? true ? "#eff6ff" : "#f1f5f9",
                                color: u.is_occupied ?? true ? "#1d4ed8" : "#475569",
                              }}
                            >
                              {u.is_occupied ?? true ? "Occupied" : "Vacant"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>
                            {cash.format(Number(u.target_rent || u.monthly_rent || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Settlement Info & Mandates */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>Settlement Account</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Bank</span>
                    <strong style={{ color: "#0f172a" }}>{activeOwner?.settlement_bank_name || "NCBA Bank"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Account Number</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {activeOwner?.settlement_bank_account || "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>M-Pesa Till / Paybill</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {activeOwner?.settlement_paybill_or_till || "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>KRA PIN</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {activeOwner?.pin_number || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                  <ShieldCheck size={16} /> Verified Landlord Mandate
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#1e3a8a", lineHeight: 1.5 }}>
                  Net proceeds are disbursed directly to your configured bank account following monthly rent reconciliation and commission deduction.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("remittances")}
                  style={{
                    marginTop: 12,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "#2563eb",
                    color: "#ffffff",
                    border: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Generate Statement →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Managed Units */}
        {activeTab === "units" && (
          <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Registered Units</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>All physical units owned under this mandate</p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "10px 12px" }}>Unit</th>
                    <th style={{ padding: "10px 12px" }}>Floor / Type</th>
                    <th style={{ padding: "10px 12px" }}>Current Tenant</th>
                    <th style={{ padding: "10px 12px" }}>Occupancy</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Contract Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{u.code || u.name}</td>
                      <td style={{ padding: "12px", color: "#475569" }}>{u.floor ? `Floor ${u.floor}` : "Standard"} • {u.unit_type || "Apartment"}</td>
                      <td style={{ padding: "12px" }}>{u.tenant_name || u.active_lease?.tenant?.name || "—"}</td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: u.is_occupied ?? true ? "#ecfdf5" : "#f1f5f9",
                            color: u.is_occupied ?? true ? "#059669" : "#64748b",
                          }}
                        >
                          {u.is_occupied ?? true ? "Occupied" : "Vacant"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>
                        {cash.format(Number(u.target_rent || u.monthly_rent || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Remittance Statements */}
        {activeTab === "remittances" && (
          <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Landlord Remittance Statement</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                  Official monthly disbursement and commission statement
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={remittancePeriod.month}
                  onChange={(e) => setRemittancePeriod((p) => ({ ...p, month: Number(e.target.value) }))}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleDateString("en-US", { month: "long" })}
                    </option>
                  ))}
                </select>

                <select
                  value={remittancePeriod.year}
                  onChange={(e) => setRemittancePeriod((p) => ({ ...p, year: Number(e.target.value) }))}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={fetchRemittance}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "#2563eb",
                    color: "#ffffff",
                    border: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {remittanceLoading ? "Calculating…" : "Recalculate"}
                </button>
              </div>
            </div>

            {remittanceData ? (
              <div>
                {/* Statement Summary Card */}
                <div style={{ padding: "20px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Gross Rent Collected</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                        {cash.format(remittanceData.total_gross_collected ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Management Commission Deducted</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>
                        - {cash.format(remittanceData.total_commission_deducted ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Other Operational Deductions</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>
                        - {cash.format((remittanceData.total_maintenance_deducted ?? 0) + (remittanceData.total_service_charge_deducted ?? 0))}
                      </div>
                    </div>
                    <div style={{ borderLeft: "2px solid #2563eb", paddingLeft: 14 }}>
                      <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>Net Payout Amount</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>
                        {cash.format(
                          Math.max(
                            Number(remittanceData.total_gross_collected || 0) -
                              Number(remittanceData.total_commission_deducted || 0) -
                              Number(remittanceData.total_maintenance_deducted || 0) -
                              Number(remittanceData.total_service_charge_deducted || 0),
                            0
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per Unit Breakdown */}
                {Array.isArray(remittanceData.unit_statements) && remittanceData.unit_statements.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                          <th style={{ padding: "10px 12px" }}>Unit</th>
                          <th style={{ padding: "10px 12px" }}>Tenant</th>
                          <th style={{ padding: "10px 12px", textAlign: "right" }}>Collected</th>
                          <th style={{ padding: "10px 12px", textAlign: "right" }}>Fee</th>
                          <th style={{ padding: "10px 12px", textAlign: "right" }}>Net Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remittanceData.unit_statements.map((u: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700 }}>{u.unit_code}</td>
                            <td style={{ padding: "10px 12px" }}>{u.tenant_name}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>
                              {cash.format(Number(u.gross_collected || 0))}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626", fontFamily: "monospace" }}>
                              -{cash.format(Number(u.commission || 0))}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#16a34a", fontFamily: "monospace" }}>
                              {cash.format(Number(u.net_payout || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                Click "Recalculate" above to view the remittance ledger for this period.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Settlement & Bank Details */}
        {activeTab === "settlement" && (
          <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Disbursement & Banking Setup</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              Registered payout channels for remittances and rental proceeds
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <div style={{ padding: "16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 12, color: "#2563eb" }}>
                  <Landmark size={18} /> Primary Settlement Bank
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>Bank Name</span>
                    <strong>{activeOwner?.settlement_bank_name || "NCBA Bank"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>Account Number</span>
                    <strong style={{ fontFamily: "monospace" }}>{activeOwner?.settlement_bank_account || "Not configured"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>Branch</span>
                    <strong>{activeOwner?.settlement_bank_branch || "Nairobi"}</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: "16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 12, color: "#059669" }}>
                  <Receipt size={18} /> Mobile Money & Tax Registration
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>M-Pesa Till / Paybill</span>
                    <strong style={{ fontFamily: "monospace" }}>{activeOwner?.settlement_paybill_or_till || "Not configured"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>KRA PIN</span>
                    <strong style={{ fontFamily: "monospace" }}>{activeOwner?.pin_number || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11 }}>ID / Company Registration No.</span>
                    <strong>{activeOwner?.id_or_registration_number || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
