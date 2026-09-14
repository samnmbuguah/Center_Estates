"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Layers, DollarSign, FileText, CheckCircle2, AlertCircle,
  Download, Printer, X, Shield, Users, Wrench, Zap, MapPin, Calendar,
  ExternalLink, Info, Check, AlertTriangle, Copy, CheckCheck, Landmark
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useOrganizationBrand } from "@/lib/organization-branding";
import { money } from "@/components/module-ui";
import { kN, pct } from "../../utils/property.utils";
import type { PropertyRow } from "../../types/property.types";

interface PropertyDossierModalProps {
  property: PropertyRow | null;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
}

interface AuditItem {
  area: string;
  field: string;
  label: string;
  value: string | number | null | undefined;
  provided: boolean;
  required: boolean;
  recommendation?: string;
}

export function PropertyDossierModal({ property, onClose, onEdit }: PropertyDossierModalProps) {
  const { session } = useAuth();
  const brand = useOrganizationBrand();
  const activeOrg = session?.organizations?.find((o) => o.id === session?.activeOrganizationId);
  const organizationId = session?.activeOrganizationId;
  const organizationName =
    activeOrg?.company_name ||
    activeOrg?.name ||
    brand.name ||
    (session as any)?.organizationName ||
    (session as any)?.user?.organization_name ||
    "Legend Management Limited";

  const rawLogo = activeOrg?.logo_url || brand.logoUrl;
  let resolvedLogoUrl = rawLogo;
  const isLegend =
    organizationName.toLowerCase().includes("legend") ||
    (activeOrg?.slug && activeOrg.slug.toLowerCase().includes("legend"));

  if (!resolvedLogoUrl || resolvedLogoUrl === "/logo.png" || resolvedLogoUrl === "/center-estates-logo.png") {
    if (isLegend) {
      resolvedLogoUrl = "/legend-site-logo.png";
    } else {
      resolvedLogoUrl = resolvedLogoUrl || "/logo.png";
    }
  }

  const getFullLogoUrl = (url?: string) => {
    if (!url) return isLegend ? "/legend-site-logo.png" : "/logo.png";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    if (url.startsWith("/media/")) {
      const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.centerestates.com/api/v1").replace(/\/api\/v1\/?$/, "");
      return `${base}${url}`;
    }
    return url;
  };

  const finalLogoUrl = getFullLogoUrl(resolvedLogoUrl);

  const [fullProperty, setFullProperty] = useState<any>(property);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "audit">("summary");
  const [auditFilter, setAuditFilter] = useState<"all" | "missing" | "provided">("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (finalLogoUrl && typeof window !== "undefined") {
      const img = new Image();
      img.src = finalLogoUrl;
    }
  }, [finalLogoUrl]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    if (!property?.id || !organizationId) return;
    setLoading(true);
    apiFetch(`/property/properties/${property.id}/`, {
      headers: { "X-Property-Scope": "portfolio" },
    }, organizationId)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data) setFullProperty((prev: any) => ({ ...prev, ...data }));
      })
      .catch((err) => console.error("Failed to load property details", err))
      .finally(() => setLoading(false));
  }, [property?.id, organizationId]);

  if (!property) return null;

  const prop = fullProperty || property;
  const meta = prop.metadata || {};
  const landlord = meta.landlord || {};
  const landlordEng = meta.landlord_engagement || {};
  const buildingMeta = meta.building || {};
  const locationMeta = meta.location || {};
  const utilities: any[] = Array.isArray(meta.utilities) ? meta.utilities : [];
  const serviceProviders: any[] = Array.isArray(meta.service_providers) ? meta.service_providers : [];
  const documents: any[] = Array.isArray(meta.documents) ? meta.documents : [];
  const contacts: any[] = Array.isArray(meta.contacts) ? meta.contacts : [];

  // Compute Onboarding Audit & Completeness
  const auditList: AuditItem[] = [
    // General
    { area: "General Details", field: "name", label: "Property Name", value: prop.name, provided: Boolean(prop.name), required: true },
    { area: "General Details", field: "property_type", label: "Property Type", value: prop.property_type, provided: Boolean(prop.property_type), required: true },
    { area: "General Details", field: "lr_number", label: "LR / Title Number", value: meta.lr_number, provided: Boolean(meta.lr_number), required: true, recommendation: "Required for land registry verification" },
    { area: "General Details", field: "pin_number", label: "Property KRA PIN", value: meta.pin_number, provided: Boolean(meta.pin_number), required: false, recommendation: "Recommended for KRA rental income tax" },
    { area: "General Details", field: "year_built", label: "Year Built", value: meta.year_built, provided: Boolean(meta.year_built && Number(meta.year_built) > 0), required: false },
    { area: "General Details", field: "land_size", label: "Land Area (sq ft)", value: meta.land_size_sqft, provided: Boolean(meta.land_size_sqft), required: false },
    { area: "General Details", field: "built_up_area", label: "Built-up Area (sq ft)", value: meta.built_up_area_sqft, provided: Boolean(meta.built_up_area_sqft), required: false },

    // Location
    { area: "Location & Address", field: "address", label: "Physical Address", value: prop.address, provided: Boolean(prop.address), required: true },
    { area: "Location & Address", field: "city", label: "Town / City", value: prop.city, provided: Boolean(prop.city), required: true },
    { area: "Location & Address", field: "county", label: "County", value: locationMeta.county || prop.county, provided: Boolean(locationMeta.county || prop.county), required: true },
    { area: "Location & Address", field: "postal_code", label: "Postal Code", value: locationMeta.postal_code, provided: Boolean(locationMeta.postal_code), required: false },

    // Landlord Engagement
    { area: "Landlord Terms", field: "landlord_name", label: "Landlord / Owner Name", value: landlord.name || meta.landlord_name, provided: Boolean(landlord.name || meta.landlord_name), required: true },
    { area: "Landlord Terms", field: "landlord_pin", label: "Landlord KRA PIN", value: landlord.pin, provided: Boolean(landlord.pin), required: false, recommendation: "Required for withholding tax (WHT) certificates" },
    { area: "Landlord Terms", field: "vat_registered", label: "VAT Registration", value: landlord.vat_registered ? `VAT Registered (${landlord.vat_number || 'Recorded'})` : 'Not VAT Registered', provided: Boolean(landlord.vat_registered !== undefined), required: false },
    { area: "Landlord Terms", field: "engagement_type", label: "Engagement Type", value: landlordEng.engagement_type, provided: Boolean(landlordEng.engagement_type), required: true },
    { area: "Landlord Terms", field: "management_fee", label: "Management Fee & Rate", value: landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : null, provided: Boolean(landlordEng.management_fee_rate), required: true, recommendation: "Defines monthly agency management commission" },
    { area: "Landlord Terms", field: "payment_terms", label: "Disbursement / Payment Terms", value: landlordEng.payment_terms, provided: Boolean(landlordEng.payment_terms), required: false },

    // Buildings & Units
    { area: "Buildings & Units", field: "units", label: "Units Inventory", value: prop.units_count ? `${prop.units_count} Units Registered` : null, provided: Number(prop.units_count || 0) > 0, required: true, recommendation: "Register individual units to enable tenant leasing" },
    { area: "Buildings & Units", field: "buildings", label: "Building Blocks / Wings", value: prop.buildings_count ? `${prop.buildings_count} Buildings` : (buildingMeta.floor_numbers ? `Single Block (${buildingMeta.floor_numbers})` : null), provided: Boolean(prop.buildings_count || buildingMeta.floor_numbers), required: false },
    { area: "Buildings & Units", field: "parking_spaces", label: "Parking Allocation", value: buildingMeta.parking_spaces ? `${buildingMeta.parking_spaces} Bays` : null, provided: Boolean(buildingMeta.parking_spaces), required: false },
    { area: "Buildings & Units", field: "amenities", label: "Building Amenities", value: buildingMeta.amenities, provided: Boolean(buildingMeta.amenities), required: false, recommendation: "e.g. Borehole, Backup Generator, Lift, 24hr Guard, CCTV" },

    // Utilities
    { area: "Utilities & Meters", field: "utilities", label: "Utility Meters Register", value: utilities.length ? `${utilities.length} Meter(s) Registered` : null, provided: utilities.length > 0, required: false, recommendation: "Add water/electricity meters for automatic tenant billing" },

    // Service Lines & Facilities
    { area: "Service Lines & Facilities", field: "service_providers", label: "Service Lines / Profiles", value: serviceProviders.length ? `${serviceProviders.length} Service Line(s)` : null, provided: serviceProviders.length > 0, required: false, recommendation: "Register security, cleaning, lift, and garbage service contracts" },

    // Documents
    { area: "Documents & Compliance", field: "title_document", label: "Title Deed / Certificate", value: documents.find((d: any) => d.type === "title" || d.name?.toLowerCase().includes("title"))?.name || null, provided: documents.some((d: any) => d.type === "title" || d.name?.toLowerCase().includes("title")), required: false, recommendation: "Upload Title deed copy for legal compliance audit" },
    { area: "Documents & Compliance", field: "management_agreement", label: "Signed Agency Agreement", value: documents.find((d: any) => d.type === "management_agreement" || d.name?.toLowerCase().includes("agreement"))?.name || null, provided: documents.some((d: any) => d.type === "management_agreement" || d.name?.toLowerCase().includes("agreement")), required: false, recommendation: "Upload executed landlord agency agreement" },
    { area: "Documents & Compliance", field: "insurance", label: "Property Insurance Policy", value: documents.find((d: any) => d.type === "insurance" || d.name?.toLowerCase().includes("insurance"))?.name || null, provided: documents.some((d: any) => d.type === "insurance" || d.name?.toLowerCase().includes("insurance")), required: false, recommendation: "Upload property fire & perils insurance cover" },
  ];

  const providedCount = auditList.filter(i => i.provided).length;
  const totalCount = auditList.length;
  const score = Math.round((providedCount / totalCount) * 100);
  const requiredMissing = auditList.filter(i => i.required && !i.provided);
  const optionalMissing = auditList.filter(i => !i.required && !i.provided);

  const displayedAuditItems = auditList.filter(item => {
    if (auditFilter === "missing") return !item.provided;
    if (auditFilter === "provided") return item.provided;
    return true;
  });

  const handlePrint = () => {
    document.body.classList.add("is-printing-dossier");
    const cleanup = () => {
      document.body.classList.remove("is-printing-dossier");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportJson = () => {
    const reportData = {
      organization: organizationName,
      property: {
        id: prop.id,
        name: prop.name,
        code: prop.code,
        type: prop.property_type,
        status: prop.status,
        address: prop.address,
        city: prop.city,
        country: prop.country,
        units_count: prop.units_count,
        occupied_units: prop.occupied,
      },
      audit: {
        score,
        provided_count: providedCount,
        total_count: totalCount,
        checklist: auditList,
      },
      metadata: meta,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(prop.name || 'property').replace(/\s+/g, '_')}_property_audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* 1. SCREEN DIALOG MODAL */}
      <div
        className="screen-only"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 20px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)",
            borderRadius: 16,
            width: "100%",
            maxWidth: 1140,
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8)",
            border: "1px solid var(--color-slate-200)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Toolbar */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--color-slate-200)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--color-slate-50)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "var(--color-blue-soft)",
                  border: "1px solid var(--color-blue-200)",
                  color: "var(--color-info-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                    {prop.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: prop.status === "active" ? "var(--color-green-bg)" : "var(--color-amber-bg)",
                      color: prop.status === "active" ? "var(--color-green-text)" : "var(--color-amber-strong)",
                      border: `1px solid ${prop.status === "active" ? "var(--color-green-200)" : "var(--color-amber-200)"}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {prop.status || "Active"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: "var(--color-slate-100)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--color-slate-200)",
                      textTransform: "capitalize",
                    }}
                  >
                    {prop.property_type || "Commercial"}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>
                  <span style={{ color: "var(--color-info-dark, #1d4ed8)", fontWeight: 700 }}>{organizationName}</span> • Code: <strong style={{ color: "var(--color-info-strong)", fontFamily: "monospace" }}>{prop.code || "—"}</strong> • {prop.address}, {prop.city}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleExportJson}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--color-slate-300)",
                  color: "var(--text-muted)",
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: "var(--color-info-strong)",
                  border: "1px solid var(--color-info-deep)",
                  color: "#ffffff",
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 3px rgba(29, 78, 216, 0.2)",
                  transition: "all 0.15s ease",
                }}
              >
                <Printer size={14} />
                <span>Print / PDF Report</span>
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(prop.id); }}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--color-slate-300)",
                    color: "var(--text-primary)",
                    padding: "7px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Edit Setup
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  color: "var(--text-faint)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs & Score Bar */}
          <div
            style={{
              padding: "12px 24px",
              borderBottom: "1px solid var(--color-slate-200)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              backgroundColor: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", gap: 6, background: "var(--color-slate-100)", padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                style={{
                  background: activeTab === "summary" ? "#ffffff" : "transparent",
                  color: activeTab === "summary" ? "var(--color-info-strong)" : "var(--color-slate-500)",
                  fontWeight: activeTab === "summary" ? 800 : 600,
                  fontSize: 12,
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: activeTab === "summary" ? "1px solid var(--color-slate-300)" : "none",
                  boxShadow: activeTab === "summary" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📊 Executive Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                style={{
                  background: activeTab === "audit" ? "#ffffff" : "transparent",
                  color: activeTab === "audit" ? "var(--color-info-strong)" : "var(--color-slate-500)",
                  fontWeight: activeTab === "audit" ? 800 : 600,
                  fontSize: 12,
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: activeTab === "audit" ? "1px solid var(--color-slate-300)" : "none",
                  boxShadow: activeTab === "audit" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📋 Onboarding Audit & Gap Checklist
                <span
                  style={{
                    backgroundColor: requiredMissing.length > 0 ? "var(--color-red-bg)" : "var(--color-green-bg)",
                    color: requiredMissing.length > 0 ? "var(--color-danger-strong)" : "var(--color-success-strong)",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {totalCount - providedCount} missing
                </span>
              </button>
            </div>

            {/* Profile Completeness Progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-soft)" }}>Onboarding Readiness</span>
                  <span style={{ color: score >= 80 ? "var(--color-success-strong)" : score >= 50 ? "var(--color-amber-deep)" : "var(--color-danger-strong)" }}>
                    {score}% ({providedCount}/{totalCount} verified)
                  </span>
                </div>
                <div style={{ width: "100%", height: 7, backgroundColor: "var(--color-slate-200)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${score}%`,
                      height: "100%",
                      backgroundColor: score >= 80 ? "var(--color-success)" : score >= 50 ? "var(--color-amber)" : "var(--color-danger)",
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20, backgroundColor: "var(--color-slate-50)" }}>
            {/* TAB 1: EXECUTIVE SUMMARY */}
            {activeTab === "summary" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 4 Top KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--color-slate-200)", backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Registered Units</div>
                    <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: "var(--text-primary)" }}>{kN(prop.units_count)}</div>
                    <div style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 700, marginTop: 2 }}>{kN(prop.occupied)} Occupied ({pct(prop.occupied, prop.units_count)}%)</div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--color-slate-200)", backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contracted Monthly Rent</div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: "var(--color-info-strong)" }}>
                      {money.format(Number(prop.monthly_rent || prop.monthlyRent || 0))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginTop: 2 }}>Target revenue potential</div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--color-slate-200)", backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Landlord Engagement</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={landlord.name || meta.landlord_name || "—"}>
                      {landlord.name || meta.landlord_name || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-info-strong)", fontWeight: 700, marginTop: 2, textTransform: "capitalize" }}>
                      {String(landlordEng.engagement_type || "management").replace(/_/g, " ")} • {landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate}` : "No fee configured"}
                    </div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--color-slate-200)", backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Operations & Compliance</div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>
                      {utilities.length} Meter(s) • {serviceProviders.length} Service Line(s)
                    </div>
                    <div style={{ fontSize: 12, color: documents.length > 0 ? "var(--color-success)" : "var(--color-warning)", fontWeight: 700, marginTop: 2 }}>
                      {documents.length} Attached Document(s)
                    </div>
                  </div>
                </div>

                {/* Two Column Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Property & Legal Profile */}
                  <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: 18, backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "var(--color-info-strong)", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Building2 size={16} /> Property & Title Particulars
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>LR / Title Number:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{meta.lr_number || "—"}</strong>
                          {meta.lr_number && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(meta.lr_number, "lr")}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-ghost)" }}
                              title="Copy LR Number"
                            >
                              {copiedField === "lr" ? <CheckCheck size={14} color="var(--color-success)" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Property Tax PIN:</span>
                        <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{meta.pin_number || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Title Ownership Type:</span>
                        <strong style={{ textTransform: "capitalize", color: "var(--text-primary)" }}>{meta.title_type || "Freehold"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Year Built:</span>
                        <strong style={{ color: "var(--text-primary)" }}>{meta.year_built && Number(meta.year_built) > 0 ? meta.year_built : "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Land Area / Built Area:</span>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {meta.land_size_sqft ? `${meta.land_size_sqft} sq ft` : "—"} / {meta.built_up_area_sqft ? `${meta.built_up_area_sqft} sq ft` : "—"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Location Coordinates:</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 12 }}>
                          {meta.latitude && meta.longitude ? `${meta.latitude}, ${meta.longitude}` : "Not pinned"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Landlord & Mandate Card */}
                  <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: 18, backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "var(--color-info-strong)", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Landmark size={16} /> Landlord Mandate & Commercial Terms
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Landlord / Owner:</span>
                        <strong style={{ color: "var(--text-primary)" }}>{landlord.name || meta.landlord_name || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Landlord KRA PIN:</span>
                        <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{landlord.pin || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>VAT Registration:</span>
                        <span style={{ fontWeight: 700, color: landlord.vat_registered ? "var(--color-success)" : "var(--color-slate-500)" }}>
                          {landlord.vat_registered ? `VAT Registered (${landlord.vat_number || 'Recorded'})` : "Not Registered"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Engagement Type:</span>
                        <span style={{ textTransform: "capitalize", fontWeight: 800, color: "var(--color-info-strong)" }}>
                          {String(landlordEng.engagement_type || "management").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 6 }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Management Fee Model:</span>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : "—"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Letting Fee Model:</span>
                        <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>
                          {landlordEng.letting_fee_type ? String(landlordEng.letting_fee_type).replace(/_/g, " ") : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Facilities, Metering & Compliance Strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Utilities & Meters */}
                  <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: 18, backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 900, color: "var(--color-info-strong)", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Zap size={16} /> Utility Meters & Infrastructure ({utilities.length})
                    </h4>
                    {utilities.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>No utility meters registered yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {utilities.map((u: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--color-slate-50)", borderRadius: 8, border: "1px solid var(--color-slate-100)", fontSize: 12 }}>
                            <div>
                              <strong style={{ textTransform: "capitalize", color: "var(--text-primary)" }}>{u.type || "Utility"}</strong>
                              <span style={{ color: "var(--text-faint)", marginLeft: 6 }}>#{u.meter_number || u.account || "—"}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--color-slate-200)", color: "var(--text-muted)" }}>
                              {u.billing_type || "Direct"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operational Service Lines */}
                  <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: 18, backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 900, color: "var(--color-info-strong)", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Wrench size={16} /> Facility Service Lines ({serviceProviders.length})
                    </h4>
                    {serviceProviders.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>No service providers or SLAs assigned.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {serviceProviders.map((s: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--color-slate-50)", borderRadius: 8, border: "1px solid var(--color-slate-100)", fontSize: 12 }}>
                            <div>
                              <strong style={{ textTransform: "capitalize", color: "var(--text-primary)" }}>{s.service || s.category}</strong>
                              <span style={{ color: "var(--text-faint)", marginLeft: 6 }}>{s.provider_name || s.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)" }}>Active SLA</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Compliance & Attached Documents */}
                <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: 18, backgroundColor: "var(--surface)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 900, color: "var(--color-info-strong)", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <FileText size={16} /> Attached Compliance & Legal Documents ({documents.length})
                  </h4>
                  {documents.length === 0 ? (
                    <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fffbeb", border: "1px solid var(--color-amber-bg)", color: "var(--color-amber-strong)", fontSize: 12 }}>
                      ⚠️ No legal or compliance documents uploaded yet. We recommend uploading the Title Deed, Signed Management Agreement, and Fire Insurance Cover.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                      {documents.map((d: any, i: number) => (
                        <div key={i} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-slate-200)", background: "var(--color-slate-50)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{d.name || "Document"}</div>
                            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize" }}>{d.type || "Attachment"}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "var(--color-green-bg)", color: "var(--color-green-text)" }}>
                            VERIFIED
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes if present */}
                {meta.notes && (
                  <div style={{ padding: 16, borderRadius: 12, backgroundColor: "var(--surface)", border: "1px solid var(--color-slate-200)" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--text-faint)" }}>Onboarding Notes & Instructions</h4>
                    <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>{meta.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ONBOARDING AUDIT & GAP CHECKLIST */}
            {activeTab === "audit" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Audit Controls & Filter Pills */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAuditFilter("all")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: auditFilter === "all" ? "1px solid var(--color-info-strong)" : "1px solid var(--color-slate-300)",
                        background: auditFilter === "all" ? "var(--color-blue-soft)" : "#ffffff",
                        color: auditFilter === "all" ? "var(--color-info-strong)" : "var(--color-slate-600)",
                      }}
                    >
                      All Items ({totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter("missing")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: auditFilter === "missing" ? "1px solid var(--color-danger-strong)" : "1px solid var(--color-slate-300)",
                        background: auditFilter === "missing" ? "var(--color-red-soft)" : "#ffffff",
                        color: auditFilter === "missing" ? "var(--color-danger-strong)" : "var(--color-slate-600)",
                      }}
                    >
                      Missing Gaps ({totalCount - providedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter("provided")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: auditFilter === "provided" ? "1px solid var(--color-success-strong)" : "1px solid var(--color-slate-300)",
                        background: auditFilter === "provided" ? "var(--color-green-soft)" : "#ffffff",
                        color: auditFilter === "provided" ? "var(--color-success-strong)" : "var(--color-slate-600)",
                      }}
                    >
                      Verified ({providedCount})
                    </button>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>
                    {requiredMissing.length > 0 ? (
                      <span style={{ color: "var(--color-danger-strong)", fontWeight: 800 }}>⚠️ {requiredMissing.length} Mandatory Requirement(s) Incomplete</span>
                    ) : (
                      <span style={{ color: "var(--color-success)", fontWeight: 800 }}>✓ All Mandatory Fields Satisfied</span>
                    )}
                  </div>
                </div>

                {/* Audit Items Table */}
                <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 12, overflow: "hidden", backgroundColor: "var(--surface)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-slate-200)", backgroundColor: "var(--color-slate-50)", color: "var(--text-soft)" }}>
                        <th style={{ padding: "10px 16px", fontWeight: 800 }}>Audit Category</th>
                        <th style={{ padding: "10px 16px", fontWeight: 800 }}>Field Requirement</th>
                        <th style={{ padding: "10px 16px", fontWeight: 800 }}>Status</th>
                        <th style={{ padding: "10px 16px", fontWeight: 800 }}>Audit Value / Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAuditItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--color-slate-100)" }}>
                          <td style={{ padding: "10px 16px", color: "var(--text-faint)", fontWeight: 600 }}>{item.area}</td>
                          <td style={{ padding: "10px 16px" }}>
                            <strong style={{ color: "var(--text-primary)" }}>{item.label}</strong>
                            {item.required && <span style={{ color: "var(--color-danger)", marginLeft: 4, fontWeight: 900 }}>*</span>}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {item.provided ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, backgroundColor: "var(--color-green-bg)", color: "var(--color-green-text)" }}>
                                <CheckCircle2 size={12} /> Verified
                              </span>
                            ) : item.required ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, backgroundColor: "var(--color-red-bg)", color: "var(--color-danger-strong)" }}>
                                <AlertCircle size={12} /> Missing (Mandatory)
                              </span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, backgroundColor: "var(--color-amber-bg)", color: "var(--color-amber-strong)" }}>
                                <Info size={12} /> Optional Gap
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {item.provided ? (
                              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{String(item.value)}</span>
                            ) : (
                              <span style={{ color: item.required ? "var(--color-danger-strong)" : "var(--color-slate-500)", fontStyle: "italic" }}>
                                {item.recommendation || "Not provided during onboarding"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Toolbar */}
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--color-slate-200)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "var(--surface)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>
              Property ID: <code style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{prop.id}</code> • Center Estates Verified Record
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--color-slate-300)",
                  color: "var(--text-muted)",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: "var(--color-info-strong)",
                  border: "1px solid var(--color-info-deep)",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Printer size={15} />
                <span>Print Profile Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED PRINT / PDF REPORT PORTAL (Rendered directly in body for 100% pure print isolation) */}
      {mounted && createPortal(
        <div id="property-dossier-print-portal">
          <style dangerouslySetInnerHTML={{ __html: `
            @media screen {
              #property-dossier-print-portal {
                display: none !important;
              }
            }
            @media print {
              body.is-printing-dossier > *:not(#property-dossier-print-portal) {
                display: none !important;
              }
              #property-dossier-print-portal {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                color: var(--color-slate-900) !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                padding: 0 !important;
                margin: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #property-dossier-print-portal img {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: A4 portrait;
                margin: 12mm 12mm 14mm 12mm;
              }
              .avoid-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print-header {
                border-bottom: 2.5px solid var(--color-info-dark, #1d4ed8);
                padding-bottom: 12px;
                margin-bottom: 16px;
              }
            }
          ` }} />

          {/* Letterhead Header with Organization Logo */}
          <div className="print-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {finalLogoUrl ? (
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <img
                    src={finalLogoUrl}
                    alt={organizationName}
                    loading="eager"
                    decoding="sync"
                    style={{
                      maxHeight: 52,
                      maxWidth: 160,
                      objectFit: "contain",
                      display: "block",
                    }}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (!target.src.endsWith("/legend-site-logo.png") && !target.src.endsWith("/center-estates-logo.png")) {
                        target.src = "/legend-site-logo.png";
                      }
                    }}
                  />
                </div>
              ) : null}
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-info-dark, #1d4ed8)", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.2 }}>
                  {organizationName}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary, #0f172a)", marginTop: 2 }}>
                  OFFICIAL PROPERTY PROFILE & COMPLIANCE AUDIT
                </div>
                <div style={{ fontSize: 10, color: "var(--text-faint, #64748b)", marginTop: 2 }}>
                  Center Estates Enterprise Property Management Platform
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10, color: "var(--text-soft, #475569)", flexShrink: 0 }}>
              <div><strong>Audit Reference:</strong> CE-AUD-{String(prop.id).slice(0, 8).toUpperCase()}</div>
              <div><strong>Generated:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>Status:</strong> <span style={{ textTransform: "uppercase", fontWeight: 800, color: prop.status === "active" ? "var(--color-success, #16a34a)" : "var(--color-warning, #d97706)" }}>{prop.status || "Active"}</span></div>
            </div>
          </div>

          {/* Executive Overview Highlight Box */}
          <div className="avoid-break" style={{ border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: 14, backgroundColor: "var(--color-slate-50)", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>{prop.name}</h1>
                <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 3 }}>
                  Code: <strong>{prop.code || "—"}</strong> • Type: <strong style={{ textTransform: "capitalize" }}>{prop.property_type || "Commercial"}</strong> • Location: <strong>{prop.address}, {prop.city}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right", borderLeft: "2px solid var(--color-slate-300)", paddingLeft: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase" }}>Readiness Score</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: score >= 80 ? "var(--color-success)" : "var(--color-warning)" }}>{score}%</div>
                <div style={{ fontSize: 9, color: "var(--text-faint)" }}>{providedCount}/{totalCount} items verified</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, borderTop: "1px solid var(--color-slate-200)", paddingTop: 10, fontSize: 11 }}>
              <div>
                <span style={{ color: "var(--text-faint)", display: "block" }}>Total Units:</span>
                <strong style={{ fontSize: 13 }}>{kN(prop.units_count)} ({kN(prop.occupied)} Occupied)</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-faint)", display: "block" }}>Contracted Rent:</span>
                <strong style={{ fontSize: 13, color: "var(--color-info-dark)" }}>{money.format(Number(prop.monthly_rent || prop.monthlyRent || 0))}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-faint)", display: "block" }}>Landlord / Owner:</span>
                <strong style={{ fontSize: 12 }}>{landlord.name || meta.landlord_name || "—"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-faint)", display: "block" }}>Management Fee:</span>
                <strong style={{ fontSize: 12 }}>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate}` : "Not configured"}</strong>
              </div>
            </div>
          </div>

          {/* Section 1 & 2: Legal Credentials & Landlord Mandate */}
          <div className="avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 4 }}>
                1. Title & Property Particulars
              </div>
              <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>LR / Title No:</td><td><strong>{meta.lr_number || "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Property KRA PIN:</td><td><strong>{meta.pin_number || "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Title Type:</td><td style={{ textTransform: "capitalize" }}><strong>{meta.title_type || "Freehold"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Year Built:</td><td><strong>{meta.year_built && Number(meta.year_built) > 0 ? meta.year_built : "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Land Size / Built Area:</td><td><strong>{meta.land_size_sqft ? `${meta.land_size_sqft} sq ft` : "—"} / {meta.built_up_area_sqft ? `${meta.built_up_area_sqft} sq ft` : "—"}</strong></td></tr>
                </tbody>
              </table>
            </div>

            <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 4 }}>
                2. Landlord Mandate & Commercial Terms
              </div>
              <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Landlord Name:</td><td><strong>{landlord.name || meta.landlord_name || "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Landlord PIN:</td><td><strong>{landlord.pin || "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>VAT Registered:</td><td><strong>{landlord.vat_registered ? `Yes (${landlord.vat_number || 'Recorded'})` : 'No'}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Management Fee:</td><td><strong>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : "—"}</strong></td></tr>
                  <tr><td style={{ color: "var(--text-faint)", padding: "3px 0" }}>Letting Fee Model:</td><td><strong>{landlordEng.letting_fee_type ? String(landlordEng.letting_fee_type).replace(/_/g, " ") : "—"}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Operations, Utility Accounts & Document Register */}
          <div className="avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 4 }}>
                3. Utility Meters & Operational Services
              </div>
              <div style={{ fontSize: 10 }}>
                <div style={{ marginBottom: 4 }}><strong>Registered Meters ({utilities.length}):</strong> {utilities.length ? utilities.map((u: any) => `${u.type || 'Meter'} #${u.meter_number || u.account}`).join(", ") : "None registered"}</div>
                <div><strong>Service Lines ({serviceProviders.length}):</strong> {serviceProviders.length ? serviceProviders.map((s: any) => `${s.service || s.category} (${s.provider_name || s.name || 'Contractor'})`).join(", ") : "None registered"}</div>
              </div>
            </div>

            <div style={{ border: "1px solid var(--color-slate-200)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid var(--color-slate-100)", paddingBottom: 4 }}>
                4. Attached Legal Compliance Documents
              </div>
              <div style={{ fontSize: 10 }}>
                {documents.length === 0 ? (
                  <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>No compliance documents attached</span>
                ) : (
                  documents.map((d: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span>• {d.name} ({d.type})</span>
                      <strong style={{ color: "var(--color-success)" }}>Attached</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Onboarding Completeness Checklist */}
          <div className="avoid-break" style={{ border: "1px solid var(--color-slate-300)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ backgroundColor: "var(--color-slate-100)", padding: "8px 12px", fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase" }}>
              5. Onboarding Completeness & Compliance Audit Checklist
            </div>
            <table style={{ width: "100%", fontSize: 9.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-slate-300)", backgroundColor: "var(--color-slate-50)" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>Category</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>Requirement</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>Verification Status</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>Audit Finding / Value</th>
                </tr>
              </thead>
              <tbody>
                {auditList.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--color-slate-100)", backgroundColor: item.provided ? "#ffffff" : item.required ? "#fff1f2" : "#fffbeb" }}>
                    <td style={{ padding: "5px 10px", color: "var(--text-faint)" }}>{item.area}</td>
                    <td style={{ padding: "5px 10px" }}><strong>{item.label}</strong>{item.required && " *"}</td>
                    <td style={{ padding: "5px 10px", fontWeight: 800, color: item.provided ? "var(--color-success)" : item.required ? "var(--color-danger-strong)" : "var(--color-amber-deep)" }}>
                      {item.provided ? "✓ PROVIDED" : item.required ? "✗ MISSING (MANDATORY)" : "— NOT PROVIDED"}
                    </td>
                    <td style={{ padding: "5px 10px" }}>{item.provided ? String(item.value) : item.recommendation || "Not provided during onboarding"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 5: Sign-Off Box */}
          <div className="avoid-break" style={{ border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: 12, backgroundColor: "var(--surface-2)" }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-info-dark)", textTransform: "uppercase", marginBottom: 12 }}>
              6. Verification & Sign-Off
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, fontSize: 10 }}>
              <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 4 }}>
                <strong>Prepared By (Property Manager):</strong>
                <div style={{ marginTop: 18, color: "var(--text-faint)" }}>Signature & Date: ____________________</div>
              </div>
              <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 4 }}>
                <strong>Reviewed By (Auditor / Agent):</strong>
                <div style={{ marginTop: 18, color: "var(--text-faint)" }}>Signature & Date: ____________________</div>
              </div>
              <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 4 }}>
                <strong>Landlord Acknowledgement:</strong>
                <div style={{ marginTop: 18, color: "var(--text-faint)" }}>Signature & Date: ____________________</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, textAlign: "center", fontSize: 9, color: "var(--text-ghost)" }}>
            Center Estates Property Management ERP • Certified Audit Report Generated for {organizationName} • Page 1 of 1
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
