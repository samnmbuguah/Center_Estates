"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2, Layers, DollarSign, FileText, CheckCircle2, AlertCircle,
  Download, Printer, X, Shield, Users, Wrench, Zap, MapPin, Calendar,
  ExternalLink, Info, Check, AlertTriangle
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

  const [fullProperty, setFullProperty] = useState<any>(property);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "audit" | "details">("summary");
  const printableRef = useRef<HTMLDivElement>(null);

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
    { area: "General Details", field: "year_built", label: "Year Built", value: meta.year_built, provided: Boolean(meta.year_built), required: false },
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        ref={printableRef}
        style={{
          backgroundColor: "var(--card-bg, #ffffff)",
          color: "var(--text, #1e293b)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 960,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border, #e2e8f0)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-muted, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{prop.name}</h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    backgroundColor: prop.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: prop.status === "active" ? "#059669" : "#d97706",
                    textTransform: "uppercase",
                  }}
                >
                  {prop.status || "Active"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "#4f46e5",
                  }}
                >
                  {prop.property_type || "Commercial"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>
                Code: <strong style={{ color: "var(--primary, #2563eb)" }}>{prop.code || "—"}</strong> • {prop.address}, {prop.city}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn outline sm"
              onClick={handleExportJson}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <Download size={14} /> Export JSON
            </button>
            <button
              className="btn outline sm"
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <Printer size={14} /> Print / PDF Dossier
            </button>
            {onEdit && (
              <button
                className="btn primary sm"
                onClick={() => { onClose(); onEdit(prop.id); }}
                style={{ fontSize: 12 }}
              >
                Edit Setup
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 6,
                color: "var(--muted, #64748b)",
                borderRadius: 6,
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Score Bar */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`btn sm ${activeTab === "summary" ? "primary" : "ghost"}`}
              onClick={() => setActiveTab("summary")}
              style={{ fontWeight: 700, fontSize: 12 }}
            >
              📊 Executive Dossier
            </button>
            <button
              className={`btn sm ${activeTab === "audit" ? "primary" : "ghost"}`}
              onClick={() => setActiveTab("audit")}
              style={{ fontWeight: 700, fontSize: 12 }}
            >
              📋 Onboarding Audit & Gap Analysis ({totalCount - providedCount} missing)
            </button>
            <button
              className={`btn sm ${activeTab === "details" ? "primary" : "ghost"}`}
              onClick={() => setActiveTab("details")}
              style={{ fontWeight: 700, fontSize: 12 }}
            >
              🔍 Full Technical Record
            </button>
          </div>

          {/* Completeness Meter */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                <span>Profile Completeness</span>
                <span style={{ color: score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626" }}>
                  {score}% ({providedCount}/{totalCount} items)
                </span>
              </div>
              <div style={{ width: "100%", height: 6, backgroundColor: "var(--border, #e2e8f0)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${score}%`,
                    height: "100%",
                    backgroundColor: score >= 80 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Quick Metrics Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border, #e2e8f0)", backgroundColor: "var(--bg-muted, #f8fafc)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase" }}>Total Registered Units</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{kN(prop.units_count)}</div>
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>{kN(prop.occupied)} Occupied ({pct(prop.occupied, prop.units_count)}%)</div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border, #e2e8f0)", backgroundColor: "var(--bg-muted, #f8fafc)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase" }}>Contracted Monthly Rent</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#0284c7" }}>
                    {money.format(Number(prop.monthly_rent || prop.monthlyRent || 0))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted, #64748b)", marginTop: 2 }}>Target revenue</div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border, #e2e8f0)", backgroundColor: "var(--bg-muted, #f8fafc)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase" }}>Landlord Engagement</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6, color: "var(--text, #1e293b)" }}>
                    {landlord.name || meta.landlord_name || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--primary, #2563eb)", marginTop: 2, textTransform: "capitalize" }}>
                    {String(landlordEng.engagement_type || "management").replace(/_/g, " ")} • {landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate}` : "No fee configured"}
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border, #e2e8f0)", backgroundColor: "var(--bg-muted, #f8fafc)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase" }}>Operations & Compliance</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>
                    {utilities.length} Meter(s) • {serviceProviders.length} Service Line(s)
                  </div>
                  <div style={{ fontSize: 11, color: documents.length > 0 ? "#16a34a" : "#d97706", marginTop: 2 }}>
                    {documents.length} Uploaded Document(s)
                  </div>
                </div>
              </div>

              {/* Two Column Summary Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Property & Legal Profile */}
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "var(--primary, #2563eb)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={16} /> Property & Title Credentials
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>LR / Title No:</span>
                      <strong>{meta.lr_number || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Property KRA PIN:</span>
                      <strong>{meta.pin_number || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Title Type:</span>
                      <strong style={{ textTransform: "capitalize" }}>{meta.title_type || "Freehold"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Year Built:</span>
                      <strong>{meta.year_built || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Land Size / Built Area:</span>
                      <strong>{meta.land_size_sqft ? `${meta.land_size_sqft} sq ft` : "—"} / {meta.built_up_area_sqft ? `${meta.built_up_area_sqft} sq ft` : "—"}</strong>
                    </div>
                  </div>
                </div>

                {/* Landlord Engagement & Terms */}
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "var(--primary, #2563eb)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield size={16} /> Landlord Mandate & Terms
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Owner / Landlord:</span>
                      <strong>{landlord.name || meta.landlord_name || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Landlord PIN:</span>
                      <strong>{landlord.pin || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Management Fee:</span>
                      <strong>{landlordEng.management_fee_rate ? `${landlordEng.management_fee_rate} (${landlordEng.management_fee_basis || 'standard'})` : "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Letting Fee Model:</span>
                      <strong>{landlordEng.letting_fee_type ? String(landlordEng.letting_fee_type).replace(/_/g, " ") : "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border, #f1f5f9)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--muted, #64748b)" }}>Disbursement Terms:</span>
                      <strong>{landlordEng.payment_terms || "—"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Lines & Document Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Service Lines */}
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "var(--primary, #2563eb)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Wrench size={16} /> Operational Service Lines ({serviceProviders.length})
                  </h4>
                  {serviceProviders.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted, #64748b)", fontStyle: "italic" }}>
                      No service lines registered. You can add security, cleaning, or maintenance in onboarding.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                      {serviceProviders.map((sp: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                          <span><strong>{sp.service || sp.category}</strong> ({sp.frequency || 'Monthly'})</span>
                          <span style={{ color: "var(--muted, #64748b)" }}>{sp.name || sp.provider_name || 'Unassigned'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Uploaded Documents */}
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "var(--primary, #2563eb)", display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={16} /> Compliance Documents ({documents.length})
                  </h4>
                  {documents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted, #64748b)", fontStyle: "italic" }}>
                      No compliance documents attached. Title deeds, agency agreements, and insurance policies can be uploaded.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                      {documents.map((doc: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                          <span><strong>{doc.name}</strong> <small style={{ color: "var(--muted)" }}>({doc.type})</small></span>
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Attached</span>
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
              {/* Audit Summary Alert */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  backgroundColor: requiredMissing.length === 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
                  border: `1px solid ${requiredMissing.length === 0 ? "#10b981" : "#f59e0b"}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                {requiredMissing.length === 0 ? (
                  <CheckCircle2 size={22} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 800 }}>
                    {requiredMissing.length === 0 ? "All Mandatory Onboarding Records Complete" : `${requiredMissing.length} Mandatory Onboarding Field(s) Incomplete`}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary, #475569)" }}>
                    {requiredMissing.length === 0
                      ? "This property profile has all necessary legal and structural setup areas complete and is fully operational for leasing, billing, and work orders."
                      : "The following items are missing from the property profile. Click 'Edit Setup' to provide missing data."}
                  </p>
                </div>
              </div>

              {/* Detailed Checklist Table */}
              <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, overflow: "hidden" }}>
                <table className="fc-data-table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-muted, #f8fafc)" }}>
                      <th style={{ width: "22%" }}>Setup Area</th>
                      <th style={{ width: "28%" }}>Field / Document Requirement</th>
                      <th style={{ width: "15%" }}>Status</th>
                      <th style={{ width: "35%" }}>Recorded Value / Audit Finding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditList.map((item, index) => (
                      <tr key={index} style={{ backgroundColor: item.provided ? "transparent" : item.required ? "rgba(239, 68, 68, 0.04)" : "rgba(245, 158, 11, 0.02)" }}>
                        <td style={{ fontWeight: 700, color: "var(--muted, #64748b)" }}>{item.area}</td>
                        <td>
                          <strong>{item.label}</strong>
                          {item.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
                        </td>
                        <td>
                          {item.provided ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 12,
                                backgroundColor: "rgba(16, 185, 129, 0.12)",
                                color: "#15803d",
                                fontSize: 11,
                                fontWeight: 700,
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
                                backgroundColor: item.required ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                color: item.required ? "#b91c1c" : "#b45309",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <AlertCircle size={12} /> {item.required ? "Missing (Required)" : "Not Provided"}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.provided ? (
                            <span style={{ color: "var(--text, #1e293b)", fontWeight: 600 }}>{String(item.value)}</span>
                          ) : (
                            <span style={{ color: item.required ? "#b91c1c" : "var(--muted, #64748b)", fontStyle: "italic" }}>
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
              {/* Notes */}
              {meta.notes && (
                <div style={{ padding: 14, borderRadius: 10, backgroundColor: "var(--bg-muted, #f8fafc)", border: "1px solid var(--border, #e2e8f0)" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--muted, #64748b)" }}>Onboarding Notes</h4>
                  <p style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{meta.notes}</p>
                </div>
              )}

              {/* Technical JSON Dump */}
              <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 14, backgroundColor: "#0f172a", color: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>RAW PROPERTY METADATA PAYLOAD</span>
                  <button
                    className="btn ghost sm"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(meta, null, 2))}
                    style={{ color: "#38bdf8", fontSize: 11 }}
                  >
                    Copy JSON
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", maxHeight: 320, overflowY: "auto", color: "#e2e8f0" }}>
                  {JSON.stringify(meta, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg-muted, #f8fafc)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
            Property ID: <code>{prop.id}</code> • Center Estates Property Dossier
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn outline sm" onClick={onClose}>
              Close
            </button>
            <button className="btn primary sm" onClick={handlePrint}>
              <Printer size={14} style={{ marginRight: 4 }} /> Print Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
