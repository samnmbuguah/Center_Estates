"use client";

import React, { useState, useMemo } from "react";
import {
  Modal,
  Badge,
  Panel,
} from "@/components/module-ui";
import {
  PROPERTY_TYPES,
  FEATURE_FLAGS,
  filterClientChecklist,
  downloadClientChecklistCsv,
  ManagementScope,
  PropertyTypeCode,
  ChecklistItem,
} from "../../utils/onboardingChecklist";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Building2,
  Briefcase,
  Store,
  Home,
  Landmark,
  Factory,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
  Search,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Printer,
  Info,
} from "lucide-react";
import { API_BASE_URL, csrfFromCookie } from "@/lib/api";

/** Active organization id, mirroring apiFetch's localStorage fallback. */
function activeOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("ce_organization");
}

/** User-safe download failure message: never leak raw HTML error pages. */
export function downloadErrorMessage(status: number, body: string, format: string): string {
  const kind = format === "pdf" ? "PDF" : "Excel workbook";
  if (status === 404) {
    return `The ${kind} generator is not available right now (server 404). The CSV download below always works — please use it and retry later.`;
  }
  if (status === 401 || status === 403) {
    return `Your session expired before the ${kind} could be generated. Please sign in again and retry.`;
  }
  return `The ${kind} could not be generated (server error ${status}). Please retry.`;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  Briefcase,
  Store,
  Building2,
  Home,
  Landmark,
  Factory,
};

interface OnboardingChecklistModalProps {
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;
  defaultScope?: ManagementScope;
  defaultPropertyType?: PropertyTypeCode;
  initialPropertyName?: string;
}

export function OnboardingChecklistModal({
  open = false,
  onClose,
  inline = false,
  defaultScope = "both",
  defaultPropertyType = "commercial_office",
  initialPropertyName = "",
}: OnboardingChecklistModalProps) {
  const [scope, setScope] = useState<ManagementScope>(defaultScope);
  const [propertyType, setPropertyType] = useState<PropertyTypeCode>(defaultPropertyType);
  const [propertyName, setPropertyName] = useState<string>(initialPropertyName);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "mandatory" | "optional">("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Initialize feature flags state from defaults
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const flag of FEATURE_FLAGS) {
      initial[flag.key] = flag.defaultChecked;
    }
    return initial;
  });

  const toggleFlag = (key: string) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleItemCheck = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat],
    }));
  };

  // Filter checklist items based on selection
  const filteredResult = useMemo(() => {
    return filterClientChecklist(scope, propertyType, featureFlags);
  }, [scope, propertyType, featureFlags]);

  // Apply search and priority filter on top
  const displayedCategories = useMemo(() => {
    const result: Record<string, ChecklistItem[]> = {};
    const lowerSearch = searchTerm.toLowerCase().trim();

    for (const [cat, items] of Object.entries(filteredResult.categories)) {
      const matchingItems = items.filter((item) => {
        if (priorityFilter === "mandatory" && item.priority !== "Mandatory") return false;
        if (priorityFilter === "optional" && item.priority !== "Optional") return false;

        if (!lowerSearch) return true;
        return (
          item.title.toLowerCase().includes(lowerSearch) ||
          item.description.toLowerCase().includes(lowerSearch) ||
          item.category.toLowerCase().includes(lowerSearch) ||
          item.rationale.toLowerCase().includes(lowerSearch) ||
          item.source.toLowerCase().includes(lowerSearch)
        );
      });

      if (matchingItems.length > 0) {
        result[cat] = matchingItems;
      }
    }
    return result;
  }, [filteredResult, searchTerm, priorityFilter]);

  const displayedTotalCount = useMemo(() => {
    return Object.values(displayedCategories).reduce((sum, items) => sum + items.length, 0);
  }, [displayedCategories]);

  const completedCount = useMemo(() => {
    return filteredResult.items.filter((item) => checkedItems[item.id]).length;
  }, [filteredResult, checkedItems]);

  const completionPercentage = filteredResult.totalCount > 0
    ? Math.round((completedCount / filteredResult.totalCount) * 100)
    : 0;

  // Handler for file downloads (PDF, XLSX, CSV)
  const handleDownload = async (format: "pdf" | "xlsx" | "csv") => {
    setDownloadingFormat(format);
    setDownloadError(null);

    const activePropName = propertyName.trim() || "Property Onboarding";

    if (format === "csv") {
      try {
        downloadClientChecklistCsv(filteredResult.items, propertyType, activePropName);
      } catch (err: any) {
        setDownloadError("Failed to generate CSV: " + (err.message || String(err)));
      } finally {
        setDownloadingFormat(null);
      }
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      params.set("property_type", propertyType);
      params.set("property_name", activePropName);
      params.set("output", format);

      for (const [k, v] of Object.entries(featureFlags)) {
        params.set(k, v ? "true" : "false");
      }

      // Absolute API base: a same-origin /api/* path would hit the Next.js
      // frontend (which has no such route) and return an HTML 404 page.
      const organizationId = activeOrganizationId();
      const res = await fetch(`${API_BASE_URL}/property/properties/onboarding-checklist/?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "X-CSRFToken": csrfFromCookie(),
          ...(organizationId ? { "X-Organization-Id": organizationId } : {}),
        },
      });

      if (!res.ok) {
        await res.text().catch(() => "");
        throw new Error(downloadErrorMessage(res.status, "", format));
      }

      const blob = await res.blob();
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const filename = `onboarding-checklist-${propertyType}-${new Date().toISOString().slice(0, 10)}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Error downloading checklist:", err);
      setDownloadError(err.message || "Failed to download checklist file.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  if (!open && !inline) return null;

  const headerTitle = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#38bdf8",
          borderRadius: 10,
          width: 42,
          height: 42,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
        }}
      >
        <SlidersHorizontal size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
          Property &amp; Facility Onboarding Checklist
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
          Tailored document matrix, statutory compliance requirements, and ready-to-print handover checklists
        </div>
      </div>
    </div>
  );

  const mainContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 16 }}>
        {/* Top Controls: Scope, Property Type, and Property Name */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            background: "var(--surface-muted, rgba(255, 255, 255, 0.03))",
            padding: 16,
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          {/* Management Scope Selector */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
              1. Management Mandate Scope
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 6,
                background: "var(--surface, rgba(0, 0, 0, 0.2))",
                padding: 4,
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              {[
                { id: "both", label: "Integrated (PM + FM)", sub: "Full Scope" },
                { id: "property", label: "Property Mgmt", sub: "Leasing & Rent" },
                { id: "facility", label: "Facility Mgmt", sub: "Assets & Maint." },
              ].map((s) => {
                const isSelected = scope === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScope(s.id as ManagementScope)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: isSelected ? "1px solid var(--color-blue, #3b82f6)" : "1px solid transparent",
                      background: isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent",
                      color: isSelected ? "#60a5fa" : "var(--muted)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500 }}>{s.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{s.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Property Name Input */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
              2. Target Property Name / Asset Ref
            </label>
            <input
              type="text"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder="e.g. Riverside Commercial Centre, Block B"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface, rgba(0, 0, 0, 0.2))",
                color: "var(--text-main)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Property Type Grid Selector */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
              3. Select Property Classification
            </label>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Determines statutory, spatial, and mechanical onboarding requirements
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {PROPERTY_TYPES.map((type) => {
              const IconComp = TYPE_ICONS[type.iconName] || Building2;
              const isSelected = propertyType === type.code;

              return (
                <div
                  key={type.code}
                  onClick={() => setPropertyType(type.code)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: isSelected
                      ? "2px solid #3b82f6"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.08)"
                      : "var(--surface-muted, rgba(255, 255, 255, 0.02))",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 90,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: isSelected ? "rgba(59, 130, 246, 0.2)" : "var(--surface-active, rgba(255, 255, 255, 0.05))",
                        color: isSelected ? "#60a5fa" : "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconComp size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isSelected ? "#93c5fd" : "var(--text-main)",
                          lineHeight: 1.2,
                        }}
                      >
                        {type.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          marginTop: 4,
                          lineHeight: 1.3,
                        }}
                      >
                        {type.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6" }}>Selected ✓</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Features Checklist */}
        <div
          style={{
            background: "var(--surface-muted, rgba(255, 255, 255, 0.02))",
            padding: 16,
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                4. Operational & Plant Configurations
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                Check all amenities and systems present on this property to refine checklist items
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const allOn: Record<string, boolean> = {};
                  for (const f of FEATURE_FLAGS) allOn[f.key] = true;
                  setFeatureFlags(allOn);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 11,
                  color: "#38bdf8",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Select All
              </button>
              <span style={{ color: "var(--border)" }}>•</span>
              <button
                type="button"
                onClick={() => {
                  const allOff: Record<string, boolean> = {};
                  for (const f of FEATURE_FLAGS) allOff[f.key] = false;
                  setFeatureFlags(allOff);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 11,
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {FEATURE_FLAGS.map((flag) => {
              const isChecked = Boolean(featureFlags[flag.key]);
              return (
                <label
                  key={flag.key}
                  onClick={() => toggleFlag(flag.key)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isChecked ? "rgba(59, 130, 246, 0.06)" : "transparent",
                    border: isChecked ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid var(--border)",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent onClick
                    style={{ marginTop: 3, accentColor: "#3b82f6" }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: isChecked ? 700 : 500, color: isChecked ? "#93c5fd" : "var(--text-main)" }}>
                      {flag.label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.25, marginTop: 2 }}>
                      {flag.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Download Action Bar & KPI Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
          }}
        >
          {/* Summary KPIs */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
                Total Requirements
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8" }}>
                {filteredResult.totalCount}
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginLeft: 6 }}>
                  across {filteredResult.categoriesCount} categories
                </span>
              </div>
            </div>

            <div style={{ height: 36, width: 1, background: "var(--border)" }} />

            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
                Priority Breakdown
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2 }}>
                <span
                  style={{
                    background: "rgba(220, 38, 38, 0.15)",
                    border: "1px solid rgba(220, 38, 38, 0.3)",
                    color: "#f87171",
                    padding: "2px 8px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {filteredResult.mandatoryCount} Mandatory
                </span>
                <span
                  style={{
                    background: "rgba(148, 163, 184, 0.15)",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    color: "#cbd5e1",
                    padding: "2px 8px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {filteredResult.optionalCount} Optional
                </span>
              </div>
            </div>

            <div style={{ height: 36, width: 1, background: "var(--border)" }} />

            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
                Readiness Tracker
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: completionPercentage === 100 ? "#4ade80" : "var(--text-main)" }}>
                  {completedCount} / {filteredResult.totalCount} ({completionPercentage}%)
                </span>
              </div>
            </div>
          </div>

          {/* Action Download Buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              disabled={downloadingFormat !== null}
              onClick={() => handleDownload("pdf")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                cursor: downloadingFormat !== null ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={16} />
              {downloadingFormat === "pdf" ? "Generating PDF..." : "Download Official PDF"}
            </button>

            <button
              type="button"
              disabled={downloadingFormat !== null}
              onClick={() => handleDownload("xlsx")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                cursor: downloadingFormat !== null ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <FileSpreadsheet size={16} />
              {downloadingFormat === "xlsx" ? "Generating Excel..." : "Download Excel (.xlsx)"}
            </button>

            <button
              type="button"
              disabled={downloadingFormat !== null}
              onClick={() => handleDownload("csv")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface, rgba(255, 255, 255, 0.05))",
                color: "var(--text-main)",
                fontWeight: 600,
                fontSize: 13,
                cursor: downloadingFormat !== null ? "not-allowed" : "pointer",
              }}
            >
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        {downloadError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{downloadError}</span>
          </div>
        )}

        {/* Live Search and Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface, rgba(0, 0, 0, 0.2))",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                width: "100%",
              }}
            >
              <Search size={16} color="var(--muted)" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search checklist (e.g. lease, generator, tax pin, as-built, insurance)..."
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-main)",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Filter Priority:</span>
            {(["all", "mandatory", "optional"] as const).map((filter) => {
              const isSelected = priorityFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setPriorityFilter(filter)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: isSelected ? "1px solid #3b82f6" : "1px solid var(--border)",
                    background: isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent",
                    color: isSelected ? "#60a5fa" : "var(--muted)",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Requirements Accordion by Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.keys(displayedCategories).length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                background: "var(--surface-muted, rgba(255, 255, 255, 0.02))",
                borderRadius: 12,
                border: "1px dashed var(--border)",
                color: "var(--muted)",
              }}
            >
              <Info size={32} style={{ margin: "0 auto 12px auto", opacity: 0.6 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>No matching checklist items</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Adjust your search query or reset priority filter to see more items.
              </div>
            </div>
          ) : (
            Object.entries(displayedCategories).map(([category, items]) => {
              const isCollapsed = expandedCategories[category] === true;
              const catMandatory = items.filter((i) => i.priority === "Mandatory").length;
              const catChecked = items.filter((i) => checkedItems[i.id]).length;

              return (
                <div
                  key={category}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface-muted, rgba(255, 255, 255, 0.02))",
                    overflow: "hidden",
                  }}
                >
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategoryExpand(category)}
                    style={{
                      padding: "12px 16px",
                      background: "var(--surface-active, rgba(255, 255, 255, 0.04))",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      cursor: "pointer",
                      borderBottom: isCollapsed ? "none" : "1px solid var(--border)",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}>
                        {category}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          background: "var(--surface, rgba(0, 0, 0, 0.3))",
                          padding: "2px 8px",
                          borderRadius: 99,
                          color: "var(--muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {items.length} {items.length === 1 ? "item" : "items"} ({catMandatory} mandatory)
                      </span>
                      {catChecked > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#4ade80",
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontWeight: 700,
                          }}
                        >
                          {catChecked} / {items.length} prepared
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 11 }}>{isCollapsed ? "Expand" : "Collapse"}</span>
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                  </div>

                  {/* Category Items */}
                  {!isCollapsed && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {items.map((item, idx) => {
                        const isItemChecked = Boolean(checkedItems[item.id]);

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: "14px 16px",
                              display: "flex",
                              gap: 14,
                              alignItems: "flex-start",
                              borderBottom: idx === items.length - 1 ? "none" : "1px solid var(--border)",
                              background: isItemChecked ? "rgba(34, 197, 94, 0.04)" : "transparent",
                              transition: "background 0.15s ease",
                            }}
                          >
                            {/* Interactive preparation checkbox (square = multi-select) */}
                            <button
                              type="button"
                              onClick={() => toggleItemCheck(item.id)}
                              role="checkbox"
                              aria-checked={isItemChecked}
                              aria-label={`Mark "${item.title}" as ${isItemChecked ? "pending" : "prepared"}`}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                color: isItemChecked ? "#22c55e" : "var(--muted)",
                                marginTop: 2,
                                flexShrink: 0,
                              }}
                              title={isItemChecked ? "Mark as pending" : "Mark as prepared/received"}
                            >
                              {isItemChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>

                            {/* Content & Details */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: isItemChecked ? "var(--muted)" : "var(--text-main)",
                                    textDecoration: isItemChecked ? "line-through" : "none",
                                  }}
                                >
                                  {item.title}
                                </span>

                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: 99,
                                    textTransform: "uppercase",
                                    background:
                                      item.priority === "Mandatory"
                                        ? "rgba(220, 38, 38, 0.15)"
                                        : "rgba(148, 163, 184, 0.15)",
                                    color: item.priority === "Mandatory" ? "#f87171" : "#94a3b8",
                                    border:
                                      item.priority === "Mandatory"
                                        ? "1px solid rgba(220, 38, 38, 0.3)"
                                        : "1px solid rgba(148, 163, 184, 0.3)",
                                  }}
                                >
                                  {item.priority}
                                </span>

                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "var(--surface, rgba(0, 0, 0, 0.25))",
                                    color: "var(--muted)",
                                  }}
                                >
                                  {item.scope.join(" & ").toUpperCase()}
                                </span>

                                {item.source && (
                                  <span style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                                    Source: {item.source}
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: 12, color: "var(--text-secondary, var(--text-main))", lineHeight: 1.4, marginBottom: 6 }}>
                                {item.description}
                              </div>

                              {/* Technical Metadata Pills */}
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
                                <div>
                                  <strong style={{ color: "var(--text-main)" }}>Purpose: </strong>
                                  <span>{item.rationale}</span>
                                </div>
                                <div>
                                  <strong style={{ color: "var(--text-main)" }}>Accepted Format: </strong>
                                  <span style={{ fontFamily: "ui-monospace, monospace", color: "#38bdf8" }}>{item.format}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
  );

  if (inline) {
    return (
      <div
        className="onboarding-checklist-inline-panel"
        style={{
          width: "100%",
          maxWidth: 1320,
          margin: "0 auto",
          padding: "24px 28px",
          background: "var(--surface, #ffffff)",
          borderRadius: 16,
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          {headerTitle}
        </div>
        {mainContent}
      </div>
    );
  }

  return (
    <Modal
      onClose={onClose || (() => {})}
      maxWidth="lg"
      title={headerTitle}
    >
      {mainContent}
    </Modal>
  );
}
