"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  TrendingUp,
  Receipt,
  Download,
  Gauge,
  Layers,
  Wrench,
  CreditCard,
  Phone,
  Mail,
  Menu,
  X,
} from "lucide-react";
import { Button, Chip } from "@mui/material";

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

type Tab = "estate" | "unit" | "units" | "remittances" | "ledger" | "settlement";

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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [propertyChargeInvoices, setPropertyChargeInvoices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("estate");
  const [estateBillingView, setEstateBillingView] = useState<"invoices" | "statement">("invoices");
  const [feeTypeFilter, setFeeTypeFilter] = useState<"all" | "management" | "letting">("all");
  const [downloadingInvId, setDownloadingInvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Remittance state
  const now = new Date();
  const [remittancePeriod, setRemittancePeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [remittanceData, setRemittanceData] = useState<any>(null);

  // Scope invoices strictly to activeOwner account
  const ownerInvoices = useMemo<any[]>(() => {
    if (!activeOwner) return [];
    return invoices.filter((inv: any) => {
      const idMatch =
        (inv.owner && String(inv.owner) === String(activeOwner.id)) ||
        (inv.owner_id && String(inv.owner_id) === String(activeOwner.id)) ||
        (inv.metadata?.owner_id && String(inv.metadata.owner_id) === String(activeOwner.id));
      const nameMatch =
        inv.landlord_name &&
        activeOwner.name &&
        inv.landlord_name.trim().toLowerCase() === activeOwner.name.trim().toLowerCase();
      return idMatch || nameMatch;
    });
  }, [invoices, activeOwner]);

  const filteredOwnerInvoices = useMemo<any[]>(() => {
    if (feeTypeFilter === "all") return ownerInvoices;
    return ownerInvoices.filter((inv: any) => (inv.fee_type || "management") === feeTypeFilter);
  }, [ownerInvoices, feeTypeFilter]);

  async function handleDownloadInvoicePdf(inv: any) {
    if (!organizationId) return;
    setDownloadingInvId(inv.id);
    try {
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/pdf/`, {}, organizationId);
      if (!res.ok) {
        alert("Failed to generate Tax Invoice PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tax-Invoice-${inv.number || inv.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download invoice PDF.");
    } finally {
      setDownloadingInvId(null);
    }
  }

  async function handleDownloadPropertyInvoicePdf(inv: any) {
    if (!organizationId) return;
    try {
      const res = await apiFetch(`/property/invoices/${inv.id}/pdf/`, {}, organizationId);
      if (!res.ok) throw new Error("The property invoice PDF could not be generated.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Invoice-${inv.number || inv.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download the property invoice PDF.");
    }
  }
  const [remittanceLoading, setRemittanceLoading] = useState(false);

  // Load owners and identify target owner
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ownersRes, invRes] = await Promise.all([
        apiFetch("/property/owners/", {}, organizationId),
        apiFetch("/property/landlord-invoices/", {}, organizationId),
      ]);

      if (!ownersRes.ok) {
        throw new Error(await apiErrorMessage(ownersRes, "Could not load owner portfolio."));
      }
      const data = await ownersRes.json();
      const list: Owner[] = Array.isArray(data) ? data : (data.results || []);
      setOwners(list);

      if (invRes.ok) {
        const iData = await invRes.json();
        setInvoices(Array.isArray(iData) ? iData : (iData.results || []));
      }

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

    // Never leave the previously selected landlord's records visible while
    // the newly selected profile is loading.
    setFinancialSummary(null);
    setUnits([]);
    setPropertyChargeInvoices([]);
    setRemittanceData(null);

    async function loadOwnerDetails() {
      try {
        const [sumRes, unitsRes, chargeRes] = await Promise.all([
          apiFetch(`/property/owners/${activeOwner?.id}/financial-summary/`, {}, organizationId),
          apiFetch(`/property/units/?owner=${activeOwner?.id}`, {}, organizationId),
          apiFetch(`/property/invoices/?owner=${activeOwner?.id}`, {}, organizationId),
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
        if (chargeRes.ok) {
          const chargeData = await chargeRes.json();
          setPropertyChargeInvoices(Array.isArray(chargeData) ? chargeData : (chargeData.results || []));
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
        const data = await res.json();
        setRemittanceData({
          ...data,
          ...(data.summary || {}),
          unit_statements: data.units || data.unit_statements || [],
        });
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
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 14px", borderTopColor: "#2563eb" }} />
          <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 750 }}>Opening Unit Owner & Landlord Portal…</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Loading property mandates and live financial ledgers</div>
        </div>
      </div>
    );
  }

  const firstName = activeOwner?.name ? activeOwner.name.split(" ")[0] : "Landlord";
  const unitsCount = units.length || activeOwner?.units_count || 0;
  const propertyName = units[0]?.property_name || "Managed Estates";

  return (
    <div className="tenant-portal-page" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* Mobile top bar toggle */}
      <div className="tenant-portal-mobile-bar" style={{ display: "none" }}>
        <button
          type="button"
          className="tenant-mobile-menu-btn"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open portal navigation"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
        <div className="tenant-mobile-title">👑 Owner Portal · {firstName}</div>
      </div>

      <div className="tenant-portal-layout" style={{ maxWidth: 1380, margin: "0 auto", padding: "20px 24px" }}>
        {/* Vertical Left Sidebar Rail (Identical layout architecture to Tenant Portal) */}
        <aside className={`tenant-portal-sidebar ${mobileDrawerOpen ? "open" : ""}`}>
          <div className="tenant-sidebar-close-row">
            <button
              type="button"
              className="tenant-sidebar-close-btn"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Profile Card */}
          <div className="tenant-sidebar-profile" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="tenant-sidebar-profile-top">
              <div
                className="tenant-avatar-circle"
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                  color: "#ffffff",
                  fontSize: 16,
                  fontWeight: 800,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                }}
              >
                👑
              </div>
              <div className="tenant-sidebar-user-meta">
                <span className="tenant-sidebar-name" style={{ color: "#0f172a", fontWeight: 800, fontSize: 14 }}>
                  {activeOwner?.name}
                </span>
                <span className="tenant-sidebar-code" style={{ color: "#475569", fontWeight: 700, fontSize: 11 }}>
                  {activeOwner?.code} • Sectional Owner
                </span>
              </div>
            </div>

            <div className="tenant-sidebar-premises" style={{ borderTopColor: "#e2e8f0" }}>
              <Building2 size={14} color="#2563eb" />
              <span className="tenant-sidebar-unit" style={{ color: "#1d4ed8", fontWeight: 800 }}>
                {unitsCount} Unit{unitsCount === 1 ? "" : "s"}
              </span>
              <span className="tenant-sidebar-property" style={{ color: "#475569", fontWeight: 600 }}>
                {propertyName}
              </span>
            </div>

            {/* Quick Switcher dropdown for administrators or multi-owner accounts */}
            {owners.length > 1 && (
              <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px dashed #e2e8f0" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 750, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>
                  Switch Landlord
                </label>
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
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 7,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="tenant-sidebar-nav" aria-label="Owner portal sections">
            {[
              { id: "estate", label: "Estate Management", icon: <Layers size={17} />, badge: propertyChargeInvoices.length || undefined },
              { id: "unit", label: "Unit Management", icon: <Gauge size={17} /> },
              { id: "units", label: "Owned Units", icon: <Building2 size={17} />, badge: unitsCount },
              { id: "remittances", label: "Remittance Statements", icon: <FileText size={17} />, badge: "Monthly" },
              { id: "ledger", label: "Management & Letting Fees", icon: <Receipt size={17} /> },
              { id: "settlement", label: "Bank & Payout Accounts", icon: <Landmark size={17} /> },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`tenant-sidebar-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(item.id as Tab);
                    setMobileDrawerOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  style={
                    isActive
                      ? { background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, borderLeft: "3px solid #2563eb" }
                      : { color: "#334155", fontWeight: 600 }
                  }
                >
                  <span className="tenant-nav-icon">{item.icon}</span>
                  <span className="tenant-nav-label" style={{ fontWeight: isActive ? 800 : 600 }}>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className="tenant-nav-badge"
                      style={{
                        background: isActive ? "#dbeafe" : "#f1f5f9",
                        color: isActive ? "#1e40af" : "#475569",
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer Care & Support Card */}
          <div className="tenant-sidebar-footer" style={{ borderTopColor: "#e2e8f0" }}>
            <div className="tenant-support-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>Estate Management Office</strong>
              <p style={{ color: "#475569", fontSize: 12, lineHeight: 1.4, margin: "4px 0 8px" }}>
                Questions on rent reconciliations, tenant tenancies, or bank remittances?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={12} /> Direct Dispatch: +254 700 000 000
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail size={12} /> billing@centerestates.com
                </span>
              </div>
            </div>
          </div>
        </aside>

        {mobileDrawerOpen && (
          <div className="tenant-sidebar-backdrop" onClick={() => setMobileDrawerOpen(false)} />
        )}

        {/* Main Stage */}
        <main className="tenant-portal-main" style={{ flex: 1, minWidth: 0 }}>
          {/* Hero Section */}
          <section
            className="tenant-portal-hero"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: "24px 28px",
              marginBottom: 20,
            }}
          >
            <div>
              <p className="eyebrow" style={{ color: "#2563eb", fontWeight: 800, letterSpacing: "0.06em", fontSize: 11 }}>
                👑 Unit Owner & Landlord Self-Service
              </p>
              <h1 style={{ color: "#0f172a", fontSize: 28, fontWeight: 850, letterSpacing: "-0.02em", margin: "4px 0 8px" }}>
                Good day, {firstName}.
              </h1>
              <p style={{ color: "#334155", fontSize: 14, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                Track live unit occupancy, collected rent rolls, management commission deductions, and official bank remittances in one secure portal.
              </p>
              <div className="tenant-premises" style={{ color: "#475569", marginTop: 12, fontWeight: 700 }}>
                <Building2 size={16} color="#2563eb" /> {propertyName} · {unitsCount} Unit{unitsCount === 1 ? "" : "s"}
                <Chip size="small" label="100% Active Mandate" color="success" sx={{ fontWeight: 800, ml: 1 }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                variant="contained"
                startIcon={<FileText size={16} />}
                onClick={() => setActiveTab("remittances")}
                sx={{
                  bgcolor: "#2563eb",
                  "&:hover": { bgcolor: "#1d4ed8" },
                  fontWeight: 800,
                  textTransform: "none",
                  borderRadius: "8px",
                  px: 2,
                }}
              >
                Remittance Statement
              </Button>
              <Button
                variant="outlined"
                startIcon={<Printer size={16} />}
                onClick={() => window.print()}
                sx={{
                  color: "#0f172a",
                  borderColor: "#cbd5e1",
                  "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
                  fontWeight: 750,
                  textTransform: "none",
                  borderRadius: "8px",
                }}
              >
                Print Dossier
              </Button>
            </div>
          </section>

          {error && (
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", marginBottom: 20, fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* High-Contrast KPI Cards */}
          <div
            className="kpi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              className="kpi-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div className="kpi-label" style={{ color: "#475569", fontWeight: 750, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Total Managed Units
              </div>
              <div className="kpi-value" style={{ color: "#0f172a", fontSize: 28, fontWeight: 900, margin: "6px 0" }}>
                {unitsCount}
              </div>
              <div className="kpi-note" style={{ color: "#047857", fontWeight: 750, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} /> Registered in Estate Register
              </div>
            </div>

            <div
              className="kpi-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div className="kpi-label" style={{ color: "#475569", fontWeight: 750, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Active Rent Roll
              </div>
              <div className="kpi-value" style={{ color: "#0f172a", fontSize: 28, fontWeight: 900, margin: "6px 0" }}>
                {cash.format(financialSummary?.active_rent_roll ?? 0)}
              </div>
              <div className="kpi-note" style={{ color: "#334155", fontWeight: 650, fontSize: 12 }}>
                Contracted monthly lease commitments
              </div>
            </div>

            <div
              className="kpi-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div className="kpi-label" style={{ color: "#475569", fontWeight: 750, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Gross Rent Collected
              </div>
              <div className="kpi-value" style={{ color: "#047857", fontSize: 28, fontWeight: 900, margin: "6px 0" }}>
                {cash.format(financialSummary?.total_paid ?? 0)}
              </div>
              <div className="kpi-note" style={{ color: "#047857", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <TrendingUp size={13} /> Receipted tenant payments
              </div>
            </div>

            <div
              className="kpi-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div className="kpi-label" style={{ color: "#475569", fontWeight: 750, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Outstanding Rent Arrears
              </div>
              <div
                className="kpi-value"
                style={{
                  color: (financialSummary?.outstanding_balance ?? 0) > 0 ? "#b91c1c" : "#0f172a",
                  fontSize: 28,
                  fontWeight: 900,
                  margin: "6px 0",
                }}
              >
                {cash.format(financialSummary?.outstanding_balance ?? 0)}
              </div>
              <div className="kpi-note" style={{ color: (financialSummary?.outstanding_balance ?? 0) > 0 ? "#b91c1c" : "#334155", fontWeight: 650, fontSize: 12 }}>
                {(financialSummary?.outstanding_balance ?? 0) > 0 ? "Under recovery notice" : "No outstanding arrears"}
              </div>
            </div>
          </div>

          {/* Estate relationship: charges owed by the owner to estate management. */}
          {activeTab === "estate" && (
            <div className="data-panel" style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 850 }}>Estate Management</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>Service-charge invoices, payments and the owner&apos;s estate account balance.</p>
                </div>
                <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 8, background: "#f1f5f9" }}>
                  {(["invoices", "statement"] as const).map(view => <button key={view} type="button" onClick={() => setEstateBillingView(view)} style={{ border: 0, borderRadius: 6, padding: "6px 11px", cursor: "pointer", fontWeight: 800, background: estateBillingView === view ? "#2563eb" : "transparent", color: estateBillingView === view ? "#fff" : "#475569" }}>{view === "invoices" ? "Invoices" : "Statement of Account"}</button>)}
                </div>
              </div>
              {propertyChargeInvoices.length === 0 ? (
                <div style={{ padding: 34, textAlign: "center", color: "#475569", fontWeight: 650 }}>No estate or service-charge invoices have been issued to {activeOwner?.name}.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}><th style={{ padding: 10 }}>Date</th><th style={{ padding: 10 }}>Reference</th><th style={{ padding: 10 }}>Charge</th><th style={{ padding: 10, textAlign: "right" }}>Debit</th><th style={{ padding: 10, textAlign: "right" }}>Balance</th><th style={{ padding: 10 }}>Status</th><th style={{ padding: 10 }}>Document</th></tr></thead>
                    <tbody>{propertyChargeInvoices.map((inv: any) => <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: 12 }}>{inv.issued_on || inv.due_on || "—"}</td><td style={{ padding: 12, fontWeight: 800 }}>{inv.number}</td><td style={{ padding: 12 }}>{String(inv.invoice_type || inv.charge_type || "Service charge").replaceAll("_", " ")}</td><td style={{ padding: 12, textAlign: "right", fontWeight: 800 }}>{cash.format(Number(inv.amount || 0))}</td><td style={{ padding: 12, textAlign: "right", fontWeight: 850, color: Number(inv.balance || 0) > 0 ? "#b91c1c" : "#047857" }}>{cash.format(Number(inv.balance || 0))}</td><td style={{ padding: 12 }}>{inv.status}</td><td style={{ padding: 12 }}><Button size="small" variant="outlined" onClick={() => void handleDownloadPropertyInvoicePdf(inv)}>PDF</Button></td></tr>)}</tbody>
                  </table>
                  {estateBillingView === "statement" && <p style={{ margin: "14px 0 0", color: "#475569", fontSize: 12 }}>Statement view lists every estate charge chronologically with its outstanding balance.</p>}
                </div>
              )}
            </div>
          )}

          {/* Unit relationship: owned units, tenants and rent management. */}
          {activeTab === "unit" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 20 }}>
              {/* Left Column: Managed Units */}
              <div
                className="data-panel"
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  padding: "22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      Allocated Property Units
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#334155", fontWeight: 500 }}>
                      Physical units under your ownership and management agreement
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("units")}
                    style={{ fontSize: 13, fontWeight: 750, color: "#2563eb", background: "none", border: 0, cursor: "pointer" }}
                  >
                    View details →
                  </button>
                </div>

                {units.length === 0 ? (
                  <div style={{ padding: "36px", textAlign: "center", color: "#475569", fontSize: 13, fontWeight: 600 }}>
                    No units mapped to this profile yet. Contact the estate manager to register unit ownership.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                          <th style={{ padding: "10px 12px", fontWeight: 750 }}>Unit Code</th>
                          <th style={{ padding: "10px 12px", fontWeight: 750 }}>Property</th>
                          <th style={{ padding: "10px 12px", fontWeight: 750 }}>Status</th>
                          <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Monthly Rent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {units.map((u) => (
                          <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px", fontWeight: 800, color: "#0f172a" }}>Unit {u.code || u.name}</td>
                            <td style={{ padding: "12px", color: "#334155", fontWeight: 600 }}>{u.property_name || propertyName}</td>
                            <td style={{ padding: "12px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  background: "#ecfdf5",
                                  color: "#047857",
                                }}
                              >
                                ● Occupied
                              </span>
                            </td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                              {cash.format(Number(u.target_rent || u.monthly_rent || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column: Settlement & Verified Mandate */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    padding: "20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                    <Landmark size={17} color="#2563eb" /> Payout & Settlement Channel
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                      <span style={{ color: "#475569", fontWeight: 600 }}>Settlement Bank</span>
                      <strong style={{ color: "#0f172a", fontWeight: 800 }}>{activeOwner?.settlement_bank_name || "NCBA Bank"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                      <span style={{ color: "#475569", fontWeight: 600 }}>Account Number</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#0f172a" }}>
                        {activeOwner?.settlement_bank_account || "Not Configured"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                      <span style={{ color: "#475569", fontWeight: 600 }}>Branch</span>
                      <strong style={{ color: "#0f172a" }}>{activeOwner?.settlement_bank_branch || "Nairobi Main"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#475569", fontWeight: 600 }}>KRA PIN</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#0f172a" }}>
                        {activeOwner?.pin_number || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                    borderRadius: 14,
                    border: "1px solid #bfdbfe",
                    padding: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#1e40af", fontWeight: 800, fontSize: 14 }}>
                    <ShieldCheck size={18} color="#2563eb" /> Verified Landlord Mandate
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#1e3a8a", lineHeight: 1.5, fontWeight: 500 }}>
                    Net rental collections are reconciled and disbursed monthly to your registered bank account after 5.0% management commission and VAT deduction.
                  </p>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setActiveTab("remittances")}
                    sx={{
                      mt: 2,
                      bgcolor: "#2563eb",
                      "&:hover": { bgcolor: "#1d4ed8" },
                      fontWeight: 800,
                      textTransform: "none",
                      borderRadius: "7px",
                    }}
                  >
                    Generate Remittance Statement →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Managed Units */}
          {activeTab === "units" && (
            <div
              className="data-panel"
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "22px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 850, color: "#0f172a" }}>
                Sectional Units Register
              </h3>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "#334155", fontWeight: 500 }}>
                Comprehensive list of registered units, current occupants, and contracted rental values
              </p>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "12px", fontWeight: 750 }}>Unit Code</th>
                      <th style={{ padding: "12px", fontWeight: 750 }}>Property Location</th>
                      <th style={{ padding: "12px", fontWeight: 750 }}>Sectional Title Deed</th>
                      <th style={{ padding: "12px", fontWeight: 750 }}>Occupancy Status</th>
                      <th style={{ padding: "12px", fontWeight: 750, textAlign: "right" }}>Contract Rent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 12px", fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                          Unit {u.code || u.name}
                        </td>
                        <td style={{ padding: "14px 12px", color: "#334155", fontWeight: 600 }}>
                          {u.property_name || propertyName}
                        </td>
                        <td style={{ padding: "14px 12px", fontFamily: "monospace", color: "#475569", fontWeight: 650 }}>
                          {u.sectional_title_number || "Deed On File"}
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "#ecfdf5",
                              color: "#047857",
                            }}
                          >
                            ● Occupied
                          </span>
                        </td>
                        <td style={{ padding: "14px 12px", textAlign: "right", fontWeight: 850, color: "#0f172a", fontFamily: "monospace", fontSize: 14 }}>
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
            <div
              className="data-panel"
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 850, color: "#0f172a" }}>
                    Monthly Remittance & Commission Statement
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#334155", fontWeight: 500 }}>
                    Consolidated statement of rent collections, service charge, management and letting fees, payments, and net payouts
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={remittancePeriod.month}
                    onChange={(e) => setRemittancePeriod((p) => ({ ...p, month: Number(e.target.value) }))}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 750, color: "#0f172a" }}
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
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 750, color: "#0f172a" }}
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  <Button
                    variant="contained"
                    onClick={fetchRemittance}
                    sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" }, fontWeight: 800, textTransform: "none", borderRadius: "8px" }}
                  >
                    {remittanceLoading ? "Calculating…" : "Recalculate"}
                  </Button>
                </div>
              </div>

              {remittanceData ? (
                <div>
                  {/* Financial Breakdown Grid */}
                  <div
                    style={{
                      padding: "22px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      marginBottom: 22,
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 18 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Gross Collected Rent</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                          {cash.format(remittanceData.total_gross_collected ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Commission Fee Deducted</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#b91c1c", marginTop: 4 }}>
                          - {cash.format(remittanceData.total_commission_deducted ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Repairs / Operational Deductions</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#b91c1c", marginTop: 4 }}>
                          - {cash.format((remittanceData.total_maintenance_deducted ?? 0) + (remittanceData.total_service_charge_deducted ?? 0))}
                        </div>
                      </div>
                      <div style={{ borderLeft: "3px solid #2563eb", paddingLeft: 16 }}>
                        <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 800, textTransform: "uppercase" }}>Net Remittance Payout</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#047857", marginTop: 4 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
                      <div><div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Management Fees Charged / Paid</div><strong>{cash.format(Number(remittanceData.total_management_fees_charged || 0))} / {cash.format(Number(remittanceData.total_management_fees_paid || 0))}</strong></div>
                      <div><div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Letting Fees Charged / Paid</div><strong>{cash.format(Number(remittanceData.total_letting_fees_charged || 0))} / {cash.format(Number(remittanceData.total_letting_fees_paid || 0))}</strong></div>
                      <div><div style={{ fontSize: 12, color: "#475569", fontWeight: 750, textTransform: "uppercase" }}>Service Charge Deducted</div><strong>{cash.format(Number(remittanceData.total_service_charge_deducted || 0))}</strong></div>
                    </div>
                  </div>

                  {/* Unit-by-Unit Statement Table */}
                  {Array.isArray(remittanceData.unit_statements) && remittanceData.unit_statements.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                            <th style={{ padding: "10px 12px", fontWeight: 750 }}>Unit</th>
                            <th style={{ padding: "10px 12px", fontWeight: 750 }}>Occupant</th>
                            <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Collected</th>
                            <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Commission</th>
                            <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Net Payout</th>
                          </tr>
                        </thead>
                        <tbody>
                          {remittanceData.unit_statements.map((u: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "12px", fontWeight: 800, color: "#0f172a" }}>Unit {u.unit_code}</td>
                              <td style={{ padding: "12px", color: "#334155", fontWeight: 600 }}>{u.tenant_name}</td>
                              <td style={{ padding: "12px", textAlign: "right", fontWeight: 850, color: "#0f172a", fontFamily: "monospace" }}>
                                {cash.format(Number(u.gross_collected || 0))}
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", color: "#b91c1c", fontWeight: 750, fontFamily: "monospace" }}>
                                -{cash.format(Number(u.commission || 0))}
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", fontWeight: 850, color: "#047857", fontFamily: "monospace" }}>
                                {cash.format(Number(u.net_payout || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "20px", textAlign: "center", color: "#475569", fontWeight: 600 }}>
                      No statement records for this billing cycle yet.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "36px", textAlign: "center", color: "#475569", fontWeight: 600 }}>
                  Select the billing month and click &quot;Recalculate&quot; to generate the remittance ledger.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Ledger & Invoices */}
          {activeTab === "ledger" && (
            <div
              className="data-panel"
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 850, color: "#0f172a" }}>
                    Commission & Fee Invoices
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#334155", fontWeight: 500 }}>
                    Agency tax invoices plus service-charge and other property invoices billed to this owner
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6, background: "#f8fafc", padding: 4, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <button
                    type="button"
                    onClick={() => setFeeTypeFilter("all")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 750,
                      border: "none",
                      cursor: "pointer",
                      background: feeTypeFilter === "all" ? "#1d4ed8" : "transparent",
                      color: feeTypeFilter === "all" ? "#ffffff" : "#475569",
                    }}
                  >
                    All ({ownerInvoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeTypeFilter("management")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 750,
                      border: "none",
                      cursor: "pointer",
                      background: feeTypeFilter === "management" ? "#1d4ed8" : "transparent",
                      color: feeTypeFilter === "management" ? "#ffffff" : "#475569",
                    }}
                  >
                    🏢 Management ({ownerInvoices.filter((i: any) => (i.fee_type || "management") === "management").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeTypeFilter("letting")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 750,
                      border: "none",
                      cursor: "pointer",
                      background: feeTypeFilter === "letting" ? "#7c3aed" : "transparent",
                      color: feeTypeFilter === "letting" ? "#ffffff" : "#475569",
                    }}
                  >
                    🔑 Letting ({ownerInvoices.filter((i: any) => i.fee_type === "letting").length})
                  </button>
                </div>
              </div>

              {filteredOwnerInvoices.length === 0 ? (
                <div style={{ padding: "36px", textAlign: "center", color: "#475569", fontWeight: 600 }}>
                  {ownerInvoices.length === 0
                    ? `No commission or letting invoices generated yet for ${activeOwner?.name}.`
                    : `No ${feeTypeFilter} invoices found.`}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Invoice #</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Fee Category</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Billing Period</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Gross Collections</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Fee Rate</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Total Fee + VAT</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "right" }}>Net Payout</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750 }}>Status</th>
                        <th style={{ padding: "10px 12px", fontWeight: 750, textAlign: "center" }}>Document</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwnerInvoices.map((inv: any) => {
                        const isLetting = inv.fee_type === "letting";
                        return (
                          <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px", fontWeight: 800, color: "#1d4ed8", fontFamily: "monospace" }}>
                              {inv.number}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: isLetting ? "#f3e8ff" : "#eff6ff",
                                  color: isLetting ? "#7c3aed" : "#1d4ed8",
                                  border: `1px solid ${isLetting ? "#e9d5ff" : "#dbeafe"}`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {isLetting ? "🔑 Letting Fee" : "🏢 Management Fee"}
                              </span>
                            </td>
                            <td style={{ padding: "12px", color: "#0f172a", fontWeight: 700 }}>
                              {inv.billing_period}
                            </td>
                            <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 750 }}>
                              {cash.format(Number(inv.gross_collections || 0))}
                            </td>
                            <td style={{ padding: "12px", color: "#475569", fontWeight: 700 }}>
                              {isLetting ? "Fixed" : `${inv.fee_rate}%`}
                            </td>
                            <td style={{ padding: "12px", textAlign: "right", color: "#b91c1c", fontWeight: 800, fontFamily: "monospace" }}>
                              {cash.format(Number(inv.total_amount || 0))}
                            </td>
                            <td style={{ padding: "12px", textAlign: "right", color: "#047857", fontWeight: 850, fontFamily: "monospace" }}>
                              {cash.format(Number(inv.net_payout || 0))}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: inv.status === "paid" ? "#ecfdf5" : "#eff6ff",
                                  color: inv.status === "paid" ? "#047857" : "#1d4ed8",
                                }}
                              >
                                {inv.status || "Draft"}
                              </span>
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoicePdf(inv)}
                                disabled={downloadingInvId === inv.id}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#1d4ed8",
                                  fontSize: 11.5,
                                  fontWeight: 750,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                }}
                              >
                                <span>📄</span>
                                <span>{downloadingInvId === inv.id ? "Loading..." : "Tax Invoice"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Bank & Settlement Accounts */}
          {activeTab === "settlement" && (
            <div
              className="data-panel"
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 850, color: "#0f172a" }}>
                Settlement Banking & Payout Configuration
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#334155", fontWeight: 500 }}>
                Direct bank settlement instructions and mobile money payout channels
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                <div style={{ padding: "20px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 14, color: "#1d4ed8", fontSize: 14 }}>
                    <Landmark size={18} /> Primary Settlement Bank
                  </div>
                  <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>Bank Name</span>
                      <strong style={{ color: "#0f172a", fontSize: 14 }}>{activeOwner?.settlement_bank_name || "NCBA Bank"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>Account Number</span>
                      <strong style={{ fontFamily: "monospace", fontSize: 14, color: "#0f172a" }}>
                        {activeOwner?.settlement_bank_account || "Not Configured"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>Branch</span>
                      <strong style={{ color: "#0f172a", fontSize: 14 }}>{activeOwner?.settlement_bank_branch || "Nairobi Main Branch"}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "20px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 14, color: "#047857", fontSize: 14 }}>
                    <Receipt size={18} /> M-Pesa & Tax Registration
                  </div>
                  <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>M-Pesa Till / Paybill</span>
                      <strong style={{ fontFamily: "monospace", fontSize: 14, color: "#0f172a" }}>
                        {activeOwner?.settlement_paybill_or_till || "Not Configured"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>KRA PIN</span>
                      <strong style={{ fontFamily: "monospace", fontSize: 14, color: "#0f172a" }}>
                        {activeOwner?.pin_number || "—"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#475569", display: "block", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>National ID / Company Reg</span>
                      <strong style={{ color: "#0f172a", fontSize: 14 }}>
                        {activeOwner?.id_or_registration_number || "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
