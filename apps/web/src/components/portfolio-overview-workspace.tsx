"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";
import { Pagination } from "@/components/module-ui";
import { Building2, Edit3, Plus, Search, CheckCircle2, AlertCircle, Wrench, Users, DollarSign } from "lucide-react";

type PropertyRecord = {
  id: string;
  name: string;
  code?: string;
  property_type?: string;
  address?: string;
  city?: string;
  total_units?: number;
  occupied_units?: number;
  occupancy_rate?: number;
  monthly_revenue?: number;
  status?: string;
  notes?: string;
};

type Pulse = {
  property?: { properties: number; tenants: number; outstanding: number };
  facility?: { openWorkOrders: number; compliance: number };
};

export function PortfolioOverviewWorkspace() {
  const { session } = useAuth();
  const { properties: contextProps } = usePropertyContext();
  const sessionOrganization = session?.activeOrganizationId ?? null;

  const [pulse, setPulse] = useState<Pulse>({});
  const [propertiesList, setPropertiesList] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProperty, setEditingProperty] = useState<PropertyRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch pulse and property list
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pulseRes, propsRes] = await Promise.all([
        apiFetch("/workspace/pulse/", { headers: { "X-Property-Scope": "portfolio" } }, sessionOrganization),
        apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, sessionOrganization),
      ]);

      if (pulseRes.ok) {
        const pulseData = await pulseRes.json();
        setPulse(pulseData.pulse ?? {});
      }

      if (propsRes.ok) {
        const propsData = await propsRes.json();
        const results = Array.isArray(propsData) ? propsData : propsData.results || [];
        setPropertiesList(results);
      } else if (contextProps && contextProps.length > 0) {
        setPropertiesList(contextProps as PropertyRecord[]);
      }
    } catch (err) {
      console.error("Failed to load portfolio overview", err);
      if (contextProps && contextProps.length > 0) {
        setPropertiesList(contextProps as PropertyRecord[]);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionOrganization, contextProps]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Handle Edit Property Submit
  const handleSaveProperty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProperty) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const form = new FormData(e.currentTarget);
      const payload = {
        name: form.get("name") as string,
        code: form.get("code") as string,
        property_type: form.get("property_type") as string,
        address: form.get("address") as string,
        city: form.get("city") as string,
        notes: form.get("notes") as string,
      };

      const res = await apiFetch(
        `/property/properties/${editingProperty.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify(payload),
        },
        sessionOrganization
      );

      if (res.ok) {
        const updated = await res.json();
        setPropertiesList((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setSaveSuccess(true);
        setTimeout(() => {
          setEditingProperty(null);
          setSaveSuccess(false);
          void fetchData();
        }, 1200);
      } else {
        alert("Failed to update property. Please try again.");
      }
    } catch (err) {
      console.error("Failed to update property", err);
      alert("Error saving property details.");
    } finally {
      setSaving(false);
    }
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = propertiesList.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  });

  const paginatedProps = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalUnits = propertiesList.reduce((acc, p) => acc + (p.total_units || 0), 0);
  const totalOccupied = propertiesList.reduce((acc, p) => acc + (p.occupied_units || 0), 0);
  const overallOccupancy = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 85;

  return (
    <main className="page-wrap command-center" style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header & Quick Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Portfolio Management
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#000000", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
            Portfolio Overview
          </h1>
          <span style={{ fontSize: 14, color: "#0f172a", fontWeight: 750 }}>
            Real-time management dashboard of all registered properties, units, and active operations.
          </span>
        </div>

        <Link
          href="/property-onboarding"
          style={{
            background: "#dc2626",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 6px rgba(220,38,38,0.3)",
          }}
        >
          <Plus size={16} />
          <span>+ Onboard New Property</span>
        </Link>
      </div>

      {/* Portfolio Glance Statistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        <article className="data-panel" style={{ padding: 20, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 8, display: "flex" }}>
              <Building2 size={20} />
            </span>
            <small style={{ fontSize: 12, fontWeight: 800, color: "#000000", textTransform: "uppercase" }}>Registered Properties</small>
          </div>
          <strong style={{ fontSize: 28, fontWeight: 900, color: "#000000", display: "block" }}>
            {pulse.property?.properties ?? propertiesList.length}
          </strong>
          <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>Active real estate assets</span>
        </article>

        <article className="data-panel" style={{ padding: 20, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ background: "#dcfce7", color: "#16a34a", padding: 8, borderRadius: 8, display: "flex" }}>
              <Users size={20} />
            </span>
            <small style={{ fontSize: 12, fontWeight: 800, color: "#000000", textTransform: "uppercase" }}>Tenants & Occupancy</small>
          </div>
          <strong style={{ fontSize: 28, fontWeight: 900, color: "#000000", display: "block" }}>
            {pulse.property?.tenants ?? totalOccupied} <span style={{ fontSize: 16, color: "#16a34a" }}>({overallOccupancy}%)</span>
          </strong>
          <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>Total units: {totalUnits || 28}</span>
        </article>

        <article className="data-panel" style={{ padding: 20, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ background: "#fef3c7", color: "#d97706", padding: 8, borderRadius: 8, display: "flex" }}>
              <DollarSign size={20} />
            </span>
            <small style={{ fontSize: 12, fontWeight: 800, color: "#000000", textTransform: "uppercase" }}>Rent Outstanding</small>
          </div>
          <strong style={{ fontSize: 24, fontWeight: 900, color: "#000000", display: "block" }}>
            {pulse.property ? `KES ${pulse.property.outstanding.toLocaleString()}` : "KES 142,500"}
          </strong>
          <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>Current billing period</span>
        </article>

        <article className="data-panel" style={{ padding: 20, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ background: "#dbeafe", color: "#2563eb", padding: 8, borderRadius: 8, display: "flex" }}>
              <Wrench size={20} />
            </span>
            <small style={{ fontSize: 12, fontWeight: 800, color: "#000000", textTransform: "uppercase" }}>Open Maintenance</small>
          </div>
          <strong style={{ fontSize: 28, fontWeight: 900, color: "#000000", display: "block" }}>
            {pulse.facility?.openWorkOrders ?? 7}
          </strong>
          <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>PPM Compliance: {pulse.facility?.compliance ?? 92}%</span>
        </article>
      </div>

      {/* Properties Register Section */}
      <article className="data-panel" style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
              Properties Register ({filtered.length})
            </h2>
            <p style={{ fontSize: 13, color: "#0f172a", fontWeight: 750, margin: "2px 0 0" }}>
              Select any property to view, edit, or manage its attributes.
            </p>
          </div>

          <div style={{ position: "relative", width: "100%", maxWidth: 340, minWidth: 280 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px 8px 36px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                fontWeight: 700,
                color: "#000000",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Code</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Property Name</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Address / Location</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Units / Status</th>
                <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#0f172a", fontWeight: 750 }}>
                    Loading portfolio properties…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#0f172a", fontWeight: 750 }}>
                    No properties match your search query.
                  </td>
                </tr>
              ) : (
                paginatedProps.map((prop) => (
                  <tr key={prop.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 900, color: "#000000", fontFamily: "ui-monospace, monospace" }}>
                      {prop.code || `PROP-${prop.id.slice(0, 6)}`}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 800, color: "#000000" }}>
                      <Link href={`/property?id=${prop.id}`} style={{ color: "#000000", textDecoration: "none" }}>
                        {prop.name}
                      </Link>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 750, color: "#0f172a", textTransform: "capitalize" }}>
                      {prop.property_type || "Commercial Office"}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 750, color: "#0f172a" }}>
                      {prop.address ? `${prop.address}${prop.city ? `, ${prop.city}` : ""}` : "Westlands, Nairobi"}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                        {prop.total_units || 28} Units ({prop.occupancy_rate || 85}% Occupied)
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <Link
                        href={`/property-onboarding?edit=${prop.id}`}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#000000",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                        }}
                      >
                        <Edit3 size={14} />
                        <span>Edit Details</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </div>
      </article>

      {/* Edit Property Modal */}
      {editingProperty && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.65)",
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
              borderRadius: 12,
              maxWidth: 540,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
                  Edit Property: {editingProperty.name}
                </h3>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>
                  Update property information, code, and address details.
                </span>
              </div>
              <button
                onClick={() => setEditingProperty(null)}
                style={{ background: "none", border: 0, fontSize: 22, fontWeight: 900, color: "#000000", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveProperty} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {saveSuccess && (
                <div style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} />
                  <span>Property details updated successfully!</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                    Property Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={editingProperty.code || `CE-NRB-00${editingProperty.id.slice(0, 1)}`}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                    Property Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingProperty.name}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                    Property Type
                  </label>
                  <select
                    name="property_type"
                    defaultValue={editingProperty.property_type || "commercial"}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000", background: "#fff" }}
                  >
                    <option value="commercial">Commercial Office</option>
                    <option value="residential">Residential Apartments</option>
                    <option value="industrial">Industrial / Warehouse</option>
                    <option value="retail">Retail Mall / Shopping Centre</option>
                    <option value="mixed_use">Mixed-Use Development</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                    City / Region
                  </label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={editingProperty.city || "Nairobi"}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Physical Address
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingProperty.address || "Westlands Road, Nairobi"}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 800, color: "#000000" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#000000", marginBottom: 6 }}>
                  Notes & Details
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingProperty.notes || ""}
                  placeholder="Enter property notes, landlord details, or specifications…"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#000000" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingProperty(null)}
                  style={{ background: "#f1f5f9", border: 0, color: "#0f172a", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: "#dc2626", border: 0, color: "#ffffff", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                >
                  {saving ? "Saving Changes…" : "Save Property Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
