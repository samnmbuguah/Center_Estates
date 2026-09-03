"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2, Layers, DollarSign, FileText, CheckCircle2, AlertCircle,
  Download, Printer, X, Shield, Users, Wrench, Zap, MapPin, Calendar,
  ExternalLink, Info, Check, AlertTriangle, Copy, CheckCheck
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
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
  const organizationId = session?.activeOrganizationId;
  const organizationName = (session as any)?.organizationName || (session as any)?.user?.organization_name || "Legend Management Limited";


  const [fullProperty, setFullProperty] = useState<any>(property);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "audit" | "details">("summary");
  const [auditFilter, setAuditFilter] = useState<"all" | "missing" | "provided">("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
  const buildings: any[] = Array.isArray(meta.buildings) ? meta.buildings : [];

  // Compute Onboarding Audit & Completeness
  const auditList: AuditItem[] = [
    // General
    { area: "General Details", field: "name", label: "Property Name", value: prop.name, provided: Boolean(prop.name), required: true },
    { area: "General Details", field: "property_type", label: "Property Type", value: prop.property_type, provided: Boolean(prop.property_type), required: true },
    { area: "General Details", field: "lr_number", label: "LR / Title Number", value: meta.lr_number, provided: Boolean(meta.lr_number), required: true, recommendation: "Required for land registry and title search" },
    { area: "General Details", field: "pin_number", label: "Property KRA PIN", value: meta.pin_number, provided: Boolean(meta.pin_number), required: false, recommendation: "Recommended for KRA tax declarations" },
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
    { area: "Landlord Terms", field: "landlord_pin", label: "Landlord KRA PIN", value: landlord.pin, provided: Boolean(landlord.pin), required: false, recommendation: "Required for withholding tax (WHT) certificate generation" },
    { area: "Landlord Terms", field: "vat_registered", label: "VAT Registration & PIN", value: landlord.vat_registered ? `VAT Registered (${landlord.vat_number || 'PIN not recorded'})` : 'Not VAT Registered', provided: Boolean(landlord.vat_registered !== undefined), required: false },
    { area: "Landlord Terms", field: "engagement_type", label: "Engagement Type", value: landlordEng.engagement_type, provided: Boolean(landlordEng.engagement_type), required: true },
    { area: "Landlord Terms", field: "management_fee", label: "Management Fee Model & Rate", value: landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : null, provided: Boolean(landlordEng.management_fee_rate), required: true, recommendation: "Defines monthly agency management commission" },
    { area: "Landlord Terms", field: "payment_terms", label: "Disbursement / Payment Terms", value: landlordEng.payment_terms, provided: Boolean(landlordEng.payment_terms), required: false },

    // Buildings & Units
    { area: "Buildings & Units", field: "units", label: "Units Inventory", value: prop.units_count ? `${prop.units_count} Units Registered` : null, provided: Number(prop.units_count || 0) > 0, required: true, recommendation: "Register individual sectional units to enable tenant leasing" },
    { area: "Buildings & Units", field: "buildings", label: "Building Blocks / Wings", value: prop.buildings_count ? `${prop.buildings_count} Buildings` : (buildingMeta.floor_numbers ? `Single Block (${buildingMeta.floor_numbers})` : null), provided: Boolean(prop.buildings_count || buildingMeta.floor_numbers), required: false },
    { area: "Buildings & Units", field: "parking_spaces", label: "Parking Allocation", value: buildingMeta.parking_spaces ? `${buildingMeta.parking_spaces} Bays` : null, provided: Boolean(buildingMeta.parking_spaces), required: false },
    { area: "Buildings & Units", field: "amenities", label: "Building Amenities", value: buildingMeta.amenities, provided: Boolean(buildingMeta.amenities), required: false, recommendation: "e.g. Borehole, Backup Generator, Lift, 24hr Guard, CCTV" },

    // Utilities
    { area: "Utilities & Meters", field: "utilities", label: "Utility Meters Register", value: utilities.length ? `${utilities.length} Meter(s) Registered` : null, provided: utilities.length > 0, required: false, recommendation: "Add water/power meters to auto-bill unit consumption" },

    // Service Lines & Contractors
    { area: "Service Lines & Facilities", field: "service_providers", label: "Service Lines / Profiles", value: serviceProviders.length ? `${serviceProviders.length} Service Line(s)` : null, provided: serviceProviders.length > 0, required: false, recommendation: "Register security, cleaning, lift, and garbage service lines" },

    // Documents
    { area: "Documents & Compliance", field: "title_document", label: "Title Deed / Land Registry Certificate", value: documents.find((d: any) => d.type === "title" || d.name?.toLowerCase().includes("title"))?.name || null, provided: documents.some((d: any) => d.type === "title" || d.name?.toLowerCase().includes("title")), required: false, recommendation: "Upload Title deed copy for compliance audit" },
    { area: "Documents & Compliance", field: "management_agreement", label: "Signed Management Agreement", value: documents.find((d: any) => d.type === "management_agreement" || d.name?.toLowerCase().includes("agreement"))?.name || null, provided: documents.some((d: any) => d.type === "management_agreement" || d.name?.toLowerCase().includes("agreement")), required: false, recommendation: "Upload executed landlord agency agreement" },
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
    window.print();
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
    a.download = `${String(prop.name || 'property').replace(/\s+/g, '_')}_dossier_audit.json`;
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
            backgroundColor: "#ffffff",
            color: "#0f172a",
            borderRadius: 16,
            width: "100%",
            maxWidth: 1140,
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Toolbar */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#f8fafc",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
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
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>
                    {prop.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: prop.status === "active" ? "#dcfce7" : "#fef3c7",
                      color: prop.status === "active" ? "#166534" : "#92400e",
                      border: `1px solid ${prop.status === "active" ? "#bbf7d0" : "#fde68a"}`,
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
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #e2e8f0",
                      textTransform: "capitalize",
                    }}
                  >
                    {prop.property_type || "Commercial"}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  Code: <strong style={{ color: "#1d4ed8", fontFamily: "monospace" }}>{prop.code || "—"}</strong> • {prop.address}, {prop.city}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleExportJson}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
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
                  background: "#1d4ed8",
                  border: "1px solid #1e40af",
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
                <span>Print / PDF Dossier</span>
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(prop.id); }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#0f172a",
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
                  color: "#64748b",
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
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                style={{
                  background: activeTab === "summary" ? "#ffffff" : "transparent",
                  color: activeTab === "summary" ? "#1d4ed8" : "#64748b",
                  fontWeight: activeTab === "summary" ? 800 : 600,
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: activeTab === "summary" ? "1px solid #cbd5e1" : "none",
                  boxShadow: activeTab === "summary" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📊 Executive Dossier
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                style={{
                  background: activeTab === "audit" ? "#ffffff" : "transparent",
                  color: activeTab === "audit" ? "#1d4ed8" : "#64748b",
                  fontWeight: activeTab === "audit" ? 800 : 600,
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: activeTab === "audit" ? "1px solid #cbd5e1" : "none",
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
                    backgroundColor: requiredMissing.length > 0 ? "#fee2e2" : "#dcfce7",
                    color: requiredMissing.length > 0 ? "#b91c1c" : "#15803d",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 10,
                  }}
                >
                  {totalCount - providedCount} missing
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                style={{
                  background: activeTab === "details" ? "#ffffff" : "transparent",
                  color: activeTab === "details" ? "#1d4ed8" : "#64748b",
                  fontWeight: activeTab === "details" ? 800 : 600,
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: activeTab === "details" ? "1px solid #cbd5e1" : "none",
                  boxShadow: activeTab === "details" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                🔍 Full Technical Record
              </button>
            </div>

            {/* Profile Completeness Progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span style={{ color: "#475569" }}>Onboarding Readiness</span>
                  <span style={{ color: score >= 80 ? "#15803d" : score >= 50 ? "#b45309" : "#b91c1c" }}>
                    {score}% ({providedCount}/{totalCount} items verified)
                  </span>
                </div>
                <div style={{ width: "100%", height: 7, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${score}%`,
                      height: "100%",
                      backgroundColor: score >= 80 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444",
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20, backgroundColor: "#f8fafc" }}>
            {/* TAB 1: EXECUTIVE SUMMARY */}
            {activeTab === "summary" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 4 Top KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Registered Units</div>
                    <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: "#0f172a" }}>{kN(prop.units_count)}</div>
                    <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>{kN(prop.occupied)} Occupied ({pct(prop.occupied, prop.units_count)}%)</div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contracted Monthly Rent</div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: "#1d4ed8" }}>
                      {money.format(Number(prop.monthly_rent || prop.monthlyRent || 0))}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Target revenue potential</div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Landlord Engagement</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={landlord.name || meta.landlord_name || "—"}>
                      {landlord.name || meta.landlord_name || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginTop: 2, textTransform: "capitalize" }}>
                      {String(landlordEng.engagement_type || "management").replace(/_/g, " ")} • {landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate}` : "No fee configured"}
                    </div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Operations & Compliance</div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, color: "#0f172a" }}>
                      {utilities.length} Meter(s) • {serviceProviders.length} Service Line(s)
                    </div>
                    <div style={{ fontSize: 12, color: documents.length > 0 ? "#16a34a" : "#d97706", fontWeight: 700, marginTop: 2 }}>
                      {documents.length} Attached Document(s)
                    </div>
                  </div>
                </div>

                {/* Two Column Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Property & Legal Profile */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Building2 size={16} /> Property & Title Particulars
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>LR / Title Number:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontFamily: "monospace", color: "#0f172a" }}>{meta.lr_number || "—"}</strong>
                          {meta.lr_number && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(meta.lr_number, "lr")}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
                              title="Copy LR Number"
                            >
                              {copiedField === "lr" ? <CheckCheck size={14} color="#16a34a" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Property Tax PIN:</span>
                        <strong style={{ fontFamily: "monospace", color: "#0f172a" }}>{meta.pin_number || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Title Ownership Type:</span>
                        <strong style={{ textTransform: "capitalize", color: "#0f172a" }}>{meta.title_type || "Freehold"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Year Built:</span>
                        <strong style={{ color: "#0f172a" }}>{meta.year_built && Number(meta.year_built) > 0 ? meta.year_built : "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Land Area / Built Area:</span>
                        <strong style={{ color: "#0f172a" }}>{meta.land_size_sqft ? `${meta.land_size_sqft} sq ft` : "—"} / {meta.built_up_area_sqft ? `${meta.built_up_area_sqft} sq ft` : "—"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Landlord Engagement & Terms */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Shield size={16} /> Landlord Mandate & Engagement
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Owner / Landlord:</span>
                        <strong style={{ color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>{landlord.name || meta.landlord_name || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Landlord PIN:</span>
                        <strong style={{ fontFamily: "monospace", color: "#0f172a" }}>{landlord.pin || "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Management Fee:</span>
                        <strong style={{ color: "#1d4ed8" }}>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Letting Fee Model:</span>
                        <strong style={{ color: "#0f172a" }}>{landlordEng.letting_fee_type ? String(landlordEng.letting_fee_type).replace(/_/g, " ") : "—"}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Disbursement Terms:</span>
                        <strong style={{ color: "#0f172a" }}>{landlordEng.payment_terms || "—"}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Service Lines & Document Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Service Lines */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Wrench size={16} /> Operational Service Lines ({serviceProviders.length})
                    </h4>
                    {serviceProviders.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>
                        No service lines registered. Security, cleaning, lift, and garbage service lines can be added during onboarding.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        {serviceProviders.map((sp: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                            <span><strong>{sp.service || sp.category}</strong> ({sp.frequency || 'Monthly'})</span>
                            <span style={{ color: "#64748b", fontWeight: 600 }}>{sp.name || sp.provider_name || 'Unassigned'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Uploaded Documents */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, backgroundColor: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 13, fontWeight: 900, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <FileText size={16} /> Attached Compliance Documents ({documents.length})
                    </h4>
                    {documents.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>
                        No compliance documents uploaded yet. Title deeds, agency agreements, and insurance policies can be uploaded.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        {documents.map((doc: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                            <span><strong>{doc.name}</strong> <small style={{ color: "#64748b" }}>({doc.type})</small></span>
                            <span style={{ color: "#16a34a", fontWeight: 800 }}>✓ Attached</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AUDIT & GAP ANALYSIS */}
            {activeTab === "audit" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Filter & Status Ribbon */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      backgroundColor: requiredMissing.length === 0 ? "#f0fdf4" : "#fffbeb",
                      border: `1px solid ${requiredMissing.length === 0 ? "#bbf7d0" : "#fde68a"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    {requiredMissing.length === 0 ? (
                      <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                    )}
                    <div>
                      <strong style={{ fontSize: 13, color: requiredMissing.length === 0 ? "#166534" : "#92400e" }}>
                        {requiredMissing.length === 0 ? "Mandatory Legal & Billing Records Complete" : `${requiredMissing.length} Mandatory Onboarding Field(s) Incomplete`}
                      </strong>
                      <span style={{ fontSize: 12, color: "#475569", marginLeft: 8 }}>
                        {requiredMissing.length === 0
                          ? "This property is fully operational for leasing, automated billing, and facilities maintenance."
                          : "Review the checklist below to address missing information."}
                      </span>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 8, gap: 2 }}>
                    {(["all", "missing", "provided"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAuditFilter(mode)}
                        style={{
                          background: auditFilter === mode ? "#ffffff" : "transparent",
                          color: auditFilter === mode ? "#0f172a" : "#64748b",
                          fontWeight: auditFilter === mode ? 800 : 600,
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: auditFilter === mode ? "1px solid #cbd5e1" : "none",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {mode} ({mode === "all" ? totalCount : mode === "missing" ? totalCount - providedCount : providedCount})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audit Table */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", backgroundColor: "#ffffff" }}>
                  <table className="fc-data-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", width: "22%", fontWeight: 800, color: "#475569" }}>Setup Category</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", width: "28%", fontWeight: 800, color: "#475569" }}>Field / Legal Requirement</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", width: "18%", fontWeight: 800, color: "#475569" }}>Status</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", width: "32%", fontWeight: 800, color: "#475569" }}>Recorded Value / Finding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAuditItems.map((item, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: item.provided ? "#ffffff" : item.required ? "#fff1f2" : "#fffbeb" }}>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: "#64748b" }}>{item.area}</td>
                          <td style={{ padding: "10px 16px" }}>
                            <strong style={{ color: "#0f172a" }}>{item.label}</strong>
                            {item.required && <span style={{ color: "#ef4444", marginLeft: 4, fontWeight: 900 }}>*</span>}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {item.provided ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  backgroundColor: "#dcfce7",
                                  color: "#15803d",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <Check size={12} /> Provided
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  backgroundColor: item.required ? "#fee2e2" : "#fef3c7",
                                  color: item.required ? "#b91c1c" : "#b45309",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <AlertCircle size={12} /> {item.required ? "Missing (Required)" : "Not Provided"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {item.provided ? (
                              <span style={{ color: "#0f172a", fontWeight: 700 }}>{String(item.value)}</span>
                            ) : (
                              <span style={{ color: item.required ? "#b91c1c" : "#64748b", fontStyle: "italic" }}>
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

            {/* TAB 3: FULL TECHNICAL RECORD */}
            {activeTab === "details" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {meta.notes && (
                  <div style={{ padding: 16, borderRadius: 12, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Onboarding Notes</h4>
                    <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", color: "#334155" }}>{meta.notes}</p>
                  </div>
                )}

                <div style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 16, backgroundColor: "#0f172a", color: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.05em" }}>RAW PROPERTY METADATA PAYLOAD</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(meta, null, 2), "json")}
                      style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      {copiedField === "json" ? "✓ Copied" : "Copy JSON"}
                    </button>
                  </div>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", maxHeight: 340, overflowY: "auto", color: "#e2e8f0" }}>
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer Toolbar */}
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Property ID: <code style={{ fontFamily: "monospace", color: "#0f172a" }}>{prop.id}</code> • Center Estates Verified Record
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
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
                  background: "#1d4ed8",
                  border: "1px solid #1e40af",
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
                <span>Print Dossier Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED PRINT / PDF REPORT CONTAINER (Rendered purely for Print/PDF Engine) */}
      <div id="property-dossier-print-report" className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            .print-only { display: none !important; }
            .screen-only { display: flex !important; }
          }
          @media print {
            .screen-only { display: none !important; }
            .print-only {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
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
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .print-section-title {
              font-size: 13px;
              font-weight: 900;
              color: #1e3a8a;
              text-transform: uppercase;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 4px;
              margin-top: 16px;
              margin-bottom: 8px;
            }
          }
        ` }} />

        {/* Letterhead Header */}
        <div className="print-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {organizationName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
              OFFICIAL PROPERTY DOSSIER & COMPLIANCE AUDIT
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Center Estates Enterprise Property Management Platform
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#475569" }}>
            <div><strong>Audit Reference:</strong> CE-AUD-{String(prop.id).slice(0, 8).toUpperCase()}</div>
            <div><strong>Generated:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Status:</strong> <span style={{ textTransform: "uppercase", fontWeight: 800, color: prop.status === "active" ? "#16a34a" : "#d97706" }}>{prop.status || "Active"}</span></div>
          </div>
        </div>

        {/* Executive Overview Highlight Box */}
        <div className="avoid-break" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, backgroundColor: "#f8fafc", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: "#0f172a" }}>{prop.name}</h1>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                Code: <strong>{prop.code || "—"}</strong> • Type: <strong style={{ textTransform: "capitalize" }}>{prop.property_type || "Commercial"}</strong> • Location: <strong>{prop.address}, {prop.city}</strong>
              </div>
            </div>
            <div style={{ textAlign: "right", borderLeft: "2px solid #cbd5e1", paddingLeft: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Readiness Score</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: score >= 80 ? "#16a34a" : "#d97706" }}>{score}%</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{providedCount}/{totalCount} items verified</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 10, fontSize: 11 }}>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Total Units:</span>
              <strong style={{ fontSize: 13 }}>{kN(prop.units_count)} ({kN(prop.occupied)} Occupied)</strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Contracted Rent:</span>
              <strong style={{ fontSize: 13, color: "#1e3a8a" }}>{money.format(Number(prop.monthly_rent || prop.monthlyRent || 0))}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Landlord / Owner:</span>
              <strong style={{ fontSize: 12 }}>{landlord.name || meta.landlord_name || "—"}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Management Fee:</span>
              <strong style={{ fontSize: 12 }}>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate}` : "Not configured"}</strong>
            </div>
          </div>
        </div>

        {/* Section 1 & 2: Legal Credentials & Landlord Mandate */}
        <div className="avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              1. Title & Property Particulars
            </div>
            <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>LR / Title No:</td><td><strong>{meta.lr_number || "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Property KRA PIN:</td><td><strong>{meta.pin_number || "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Title Type:</td><td style={{ textTransform: "capitalize" }}><strong>{meta.title_type || "Freehold"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Year Built:</td><td><strong>{meta.year_built && Number(meta.year_built) > 0 ? meta.year_built : "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Land Size / Built Area:</td><td><strong>{meta.land_size_sqft ? `${meta.land_size_sqft} sq ft` : "—"} / {meta.built_up_area_sqft ? `${meta.built_up_area_sqft} sq ft` : "—"}</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              2. Landlord Mandate & Commercial Terms
            </div>
            <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Landlord Name:</td><td><strong>{landlord.name || meta.landlord_name || "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Landlord PIN:</td><td><strong>{landlord.pin || "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>VAT Registered:</td><td><strong>{landlord.vat_registered ? `Yes (${landlord.vat_number || 'PIN recorded'})` : 'No'}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Management Fee:</td><td><strong>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : "—"}</strong></td></tr>
                <tr><td style={{ color: "#64748b", padding: "3px 0" }}>Letting Fee Model:</td><td><strong>{landlordEng.letting_fee_type ? String(landlordEng.letting_fee_type).replace(/_/g, " ") : "—"}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Operations, Utility Accounts & Document Register */}
        <div className="avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              3. Utility Meters & Operational Services
            </div>
            <div style={{ fontSize: 10 }}>
              <div style={{ marginBottom: 4 }}><strong>Registered Meters ({utilities.length}):</strong> {utilities.length ? utilities.map((u: any) => `${u.type || 'Meter'} #${u.meter_number || u.account}`).join(", ") : "None registered"}</div>
              <div><strong>Service Lines ({serviceProviders.length}):</strong> {serviceProviders.length ? serviceProviders.map((s: any) => `${s.service || s.category} (${s.provider_name || s.name || 'Contractor'})`).join(", ") : "None registered"}</div>
            </div>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              4. Attached Legal Compliance Documents
            </div>
            <div style={{ fontSize: 10 }}>
              {documents.length === 0 ? (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>No compliance documents attached</span>
              ) : (
                documents.map((d: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span>• {d.name} ({d.type})</span>
                    <strong style={{ color: "#16a34a" }}>Attached</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Onboarding Completeness Checklist */}
        <div className="avoid-break" style={{ border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ backgroundColor: "#f1f5f9", padding: "8px 12px", fontSize: 12, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase" }}>
            5. Onboarding Completeness & Compliance Audit Checklist
          </div>
          <table style={{ width: "100%", fontSize: 9.5, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Category</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Requirement</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Verification Status</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Audit Finding / Value</th>
              </tr>
            </thead>
            <tbody>
              {auditList.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: item.provided ? "#ffffff" : item.required ? "#fff1f2" : "#fffbeb" }}>
                  <td style={{ padding: "5px 10px", color: "#64748b" }}>{item.area}</td>
                  <td style={{ padding: "5px 10px" }}><strong>{item.label}</strong>{item.required && " *"}</td>
                  <td style={{ padding: "5px 10px", fontWeight: 800, color: item.provided ? "#16a34a" : item.required ? "#b91c1c" : "#b45309" }}>
                    {item.provided ? "✓ PROVIDED" : item.required ? "✗ MISSING (MANDATORY)" : "— NOT PROVIDED"}
                  </td>
                  <td style={{ padding: "5px 10px" }}>{item.provided ? String(item.value) : item.recommendation || "Not provided during onboarding"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 5: Sign-Off Box */}
        <div className="avoid-break" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, backgroundColor: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase", marginBottom: 12 }}>
            6. Verification & Sign-Off
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, fontSize: 10 }}>
            <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
              <strong>Prepared By (Property Manager):</strong>
              <div style={{ marginTop: 18, color: "#64748b" }}>Signature & Date: ____________________</div>
            </div>
            <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
              <strong>Reviewed By (Managing Agent / Auditor):</strong>
              <div style={{ marginTop: 18, color: "#64748b" }}>Signature & Date: ____________________</div>
            </div>
            <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
              <strong>Landlord / Owner Acknowledgement:</strong>
              <div style={{ marginTop: 18, color: "#64748b" }}>Signature & Date: ____________________</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, textAlign: "center", fontSize: 9, color: "#94a3b8" }}>
          Center Estates Property Management ERP • Certified Audit Report Generated for {organizationName} • Page 1 of 1
        </div>
      </div>
    </>
  );
}
