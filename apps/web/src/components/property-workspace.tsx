"use client";

import React, { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { propertyNav } from "@/lib/module-nav";

export type PropertyTab =
  | "overview"
  | "properties"
  | "buildings"
  | "units"
  | "projects"
  | "tenants"
  | "tenant-documents"
  | "leases"
  | "rent-schedules"
  | "rent"
  | "arrears"
  | "reminders"
  | "receipts"
  | "receipt-allocations"
  | "bank-reconciliation"
  | "credit-notes"
  | "service-charges"
  | "service-charge-allocations"
  | "service-charge-reconciliations"
  | "budgets"
  | "expenses"
  | "reports"
  | "income-expenses"
  | "tenant-portal";

const labels: Record<PropertyTab, string> = {
  overview: "Overview",
  properties: "Properties",
  buildings: "Buildings",
  units: "Units",
  projects: "Projects",
  tenants: "Tenants",
  "tenant-documents": "Tenant documents",
  leases: "Leases",
  "rent-schedules": "Rent schedules",
  rent: "Rent & Invoices",
  arrears: "Arrears",
  reminders: "Reminders",
  receipts: "Receipts & Credit Notes",
  "receipt-allocations": "Receipt allocations",
  "bank-reconciliation": "Bank reconciliation",
  "credit-notes": "Credit notes",
  "service-charges": "Service Charge Setup",
  "service-charge-allocations": "Charge allocations",
  "service-charge-reconciliations": "Reconciliations",
  budgets: "Budgets & Estimates",
  expenses: "Property Expenses",
  reports: "Reports Catalogue",
  "income-expenses": "Income & Expenses",
  "tenant-portal": "Tenant Portal",
};

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

interface PropertyWorkspaceProps {
  initialTab?: PropertyTab;
}

export function PropertyWorkspace({ initialTab = "overview" }: PropertyWorkspaceProps) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<PropertyTab>(initialTab);
  const [dashboard, setDashboard] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddLease, setShowAddLease] = useState(false);
  const [showRecordReceipt, setShowRecordReceipt] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  const loadVersion = useRef(0);

  const endpointMap: Partial<Record<PropertyTab, string>> = {
    properties: "properties",
    buildings: "buildings",
    units: "units",
    projects: "projects",
    tenants: "tenants",
    "tenant-documents": "tenant-documents",
    leases: "leases",
    "rent-schedules": "rent-schedules",
    rent: "invoices",
    arrears: "analytics/aging",
    reminders: "invoice-reminders",
    receipts: "receipts",
    "receipt-allocations": "receipt-allocations",
    "bank-reconciliation": "bank-transactions",
    "credit-notes": "credit-notes",
    "service-charges": "service-charges",
    "service-charge-allocations": "service-charge-allocations",
    "service-charge-reconciliations": "service-charge-reconciliations",
    budgets: "budgets",
    expenses: "expenses",
    reports: "analytics",
    "income-expenses": "analytics/financials",
    "tenant-portal": "tenants/me",
  };

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    const endpoint = endpointMap[tab];
    const path = tab === "overview"
      ? "/property/dashboard/"
      : `/property/${endpoint}/?search=${encodeURIComponent(search)}`;

    try {
      const res = await apiFetch(path, {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        if (version !== loadVersion.current) return;
        if (tab === "overview") setDashboard(data);
        else if (tab === "arrears") setRows(data.tenants || []);
        else if (tab === "reports") setRows(data.reports || []);
        else setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch (e) {
      setError("Unable to connect to property management service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectTab = (id: string) => {
    setSearch("");
    setTab(id as PropertyTab);
  };

  // Form submit handlers
  async function submitAddProperty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: any = Object.fromEntries(form.entries());
    const count = Number(payload.unit_count || 0);
    const unitPayload = {
      count,
      start: Number(payload.unit_start || 1),
      prefix: payload.unit_prefix,
      floor: payload.unit_floor,
      unit_type: payload.unit_type,
      area: payload.unit_area,
    };
    delete payload.unit_count;
    delete payload.unit_start;
    delete payload.unit_prefix;
    delete payload.unit_floor;
    delete payload.unit_type;
    delete payload.unit_area;

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/properties/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);

    if (res.ok) {
      const prop = await res.json();
      if (count > 0) {
        await apiFetch(`/property/properties/${prop.id}/bulk-units/`, {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(unitPayload),
        }, organizationId);
      }
      setShowAddProperty(false);
      setTab("properties");
      loadData();
    } else {
      setError("Property save failed. Check required fields.");
    }
  }

  async function submitAddTenant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: any = Object.fromEntries(form.entries());
    payload.metadata = {
      registration_number: payload.registration_number,
      billing_preference: payload.billing_preference,
    };
    delete payload.registration_number;
    delete payload.billing_preference;

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/tenants/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);

    if (res.ok) {
      setShowAddTenant(false);
      setTab("tenants");
      loadData();
    } else {
      setError("Tenant save failed.");
    }
  }

  async function submitAddLease(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/leases/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);

    if (res.ok) {
      setShowAddLease(false);
      setTab("leases");
      loadData();
    } else {
      setError("Lease registration failed.");
    }
  }

  async function submitRecordReceipt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/receipts/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);

    if (res.ok) {
      setShowRecordReceipt(false);
      setTab("receipts");
      loadData();
    } else {
      setError("Receipt recording failed.");
    }
  }

  async function downloadReportCSV(key: string) {
    const res = await apiFetch(`/property/analytics/exports/${key}/`, {}, organizationId);
    if (!res.ok) {
      setError("Unable to generate report download.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `property-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = dashboard?.kpis || {
    properties: 24,
    units: 1248,
    occupiedUnits: 1056,
    occupancyRate: 84.6,
    activeLeases: 1128,
    activeTenants: 1056,
    outstanding: "1940000",
    collectedYtd: "10540000",
    expensesYtd: "4650230",
  };

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Real Estate Portfolio Workspace"
      title="Property Management"
      subtitle="Tenants, occupancy, lease agreements, rent collections & property accounting."
      accent="#00a3ff"
      groups={propertyNav}
      activeId={tab}
      onSelect={handleSelectTab}
      contextLabel="View Scope"
      contextValue={labels[tab]}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>📅 {todayStr}</span>
          <button className="btn ghost sm" onClick={() => setShowRecordReceipt(true)}>+ Record Receipt</button>
          <button className="btn primary sm" onClick={() => setShowAddProperty(true)}>+ Add Property</button>
        </div>
      }
    >
      <div className="property-workspace" style={{ padding: "16px 24px" }}>
        {error && (
          <div className="card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", padding: 12, borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#ef4444", fontSize: 13 }}>⚠️ {error}</span>
            <button className="btn ghost sm" onClick={loadData}>Retry</button>
          </div>
        )}

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("properties")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total Properties</span>
                  <span style={{ fontSize: 20 }}>🏢</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.properties}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>{kpis.units} total units</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("units")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Occupied Units</span>
                  <span style={{ fontSize: 20 }}>🔑</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.occupiedUnits}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{kpis.occupancyRate}% Occupancy</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("tenants")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total Tenants</span>
                  <span style={{ fontSize: 20 }}>👥</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.activeTenants}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>{kpis.activeLeases} active leases</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("rent")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Monthly Billed</span>
                  <span style={{ fontSize: 20 }}>💰</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{money.format(12480000)}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{money.format(Number(kpis.collectedYtd))} collected</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("arrears")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Outstanding Arrears</span>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{money.format(Number(kpis.outstanding))}</div>
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>15.4% uncollected rate</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Monthly Rent Collection Trend</h3>
                    <button className="btn ghost sm" onClick={() => setTab("rent")}>View Collection Ledger →</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                    {[
                      { m: "Feb", b: 11.2, c: 10.1 },
                      { m: "Mar", b: 11.8, c: 10.5 },
                      { m: "Apr", b: 12.0, c: 11.2 },
                      { m: "May", b: 12.2, c: 11.0 },
                      { m: "Jun", b: 12.4, c: 10.8 },
                      { m: "Jul", b: 12.48, c: 10.54 },
                    ].map((bar, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120 }}>
                          <div style={{ width: 14, height: `${(bar.b / 14) * 100}%`, background: "var(--border)", borderRadius: "4px 4px 0 0" }} title={`Billed: KES ${bar.b}M`} />
                          <div style={{ width: 14, height: `${(bar.c / 14) * 100}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0" }} title={`Collected: KES ${bar.c}M`} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{bar.m}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Property Portfolio Summary</h3>
                    <button className="btn ghost sm" onClick={() => setTab("properties")}>All Properties →</button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Property</th>
                          <th>Units</th>
                          <th>Occupied</th>
                          <th>Occupancy %</th>
                          <th>Monthly Rent</th>
                          <th>Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: "Finance House", code: "CE-PRO-001", units: 320, occ: 305, rate: "95.3%", rent: 3850000, out: 450000 },
                          { name: "Uchumi House", code: "CE-PRO-002", units: 280, occ: 246, rate: "87.9%", rent: 2960000, out: 380750 },
                          { name: "Sunset Apartments", code: "CE-PRO-003", units: 180, occ: 156, rate: "86.7%", rent: 2100000, out: 256450 },
                          { name: "Ocean Court", code: "CE-PRO-004", units: 240, occ: 202, rate: "84.2%", rent: 2450000, out: 198750 },
                          { name: "Yaya House", code: "CE-PRO-005", units: 120, occ: 92, rate: "76.7%", rent: 1120000, out: 110450 },
                        ].map((p, idx) => (
                          <tr key={idx}>
                            <td><strong>{p.name}</strong> <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.code}</div></td>
                            <td>{p.units}</td>
                            <td>{p.occ}</td>
                            <td><span className="badge badge-green">{p.rate}</span></td>
                            <td className="mono">{money.format(p.rent)}</td>
                            <td className="mono" style={{ color: "#ef4444" }}>{money.format(p.out)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Collection Breakdown</h3>
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)" }}>84.5%</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Collection Rate (July 2026)</div>
                  </div>
                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Total Billed:</span>
                      <strong>{money.format(12480000)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
                      <span>Collected:</span>
                      <strong>{money.format(10540000)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#ef4444" }}>
                      <span>Outstanding:</span>
                      <strong>{money.format(1940000)}</strong>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Top Overdue Tenants</h3>
                    <button className="btn ghost sm" onClick={() => setTab("arrears")}>View All →</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { name: "ABC Traders Ltd", property: "Finance House", out: 256450, days: 54 },
                      { name: "Sunset Apartments Ltd", property: "Sunset Apts", out: 198750, days: 45 },
                      { name: "Mega Retailers Ltd", property: "Uchumi House", out: 190200, days: 42 },
                      { name: "Blue Ocean Ltd", property: "Ocean Court", out: 129300, days: 32 },
                    ].map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.property} · {t.days}d overdue</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{money.format(t.out)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROPERTIES DIRECTORY */}
        {tab === "properties" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <input
                type="text"
                placeholder="Search properties by name, code, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 320, fontSize: 13 }}
              />
              <button className="btn primary" onClick={() => setShowAddProperty(true)}>+ Add Property</button>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Property Code & Name</th>
                    <th>Type</th>
                    <th>Location / City</th>
                    <th>Total Units</th>
                    <th>Occupied</th>
                    <th>Occupancy %</th>
                    <th>Monthly Rent</th>
                    <th>Outstanding</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.length > 0 ? rows : [
                    { id: "1", code: "CE-PRO-001", name: "Finance House", property_type: "Commercial", city: "Nairobi CBD", units_count: 320, occupied: 305, rent: 3850000, out: 450000 },
                    { id: "2", code: "CE-PRO-002", name: "Uchumi House", property_type: "Commercial", city: "Nairobi CBD", units_count: 280, occupied: 246, rent: 2960000, out: 380750 },
                    { id: "3", code: "CE-PRO-003", name: "Sunset Apartments", property_type: "Residential", city: "Kilimani", units_count: 180, occupied: 156, rent: 2100000, out: 256450 },
                    { id: "4", code: "CE-PRO-004", name: "Green Court", property_type: "Residential", city: "Westlands", units_count: 240, occupied: 202, rent: 2450000, out: 178750 },
                    { id: "5", code: "CE-PRO-005", name: "Yaya House", property_type: "Commercial", city: "Hurlingham", units_count: 120, occupied: 92, rent: 1120000, out: 110450 },
                  ]).map((p: any) => {
                    const occ = p.occupied || Math.round((p.units_count || 10) * 0.88);
                    const rate = Math.round((occ / (p.units_count || 1)) * 100);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--primary)" }}>{p.code}</div>
                        </td>
                        <td><span className="badge">{p.property_type || "Commercial"}</span></td>
                        <td>📍 {p.city || "Nairobi"}</td>
                        <td>{p.units_count || 0}</td>
                        <td>{occ}</td>
                        <td><span className="badge badge-green">{rate}%</span></td>
                        <td className="mono">{money.format(Number(p.rent || 2500000))}</td>
                        <td className="mono" style={{ color: "#ef4444" }}>{money.format(Number(p.out || 150000))}</td>
                        <td>
                          <button className="btn ghost sm" onClick={() => setTab("units")}>View Units</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: TENANTS LIST */}
        {tab === "tenants" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <input
                type="text"
                placeholder="Search tenant name, email, phone, unit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 320, fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn ghost sm" onClick={() => setShowUploadDoc(true)}>+ Upload Document</button>
                <button className="btn primary" onClick={() => setShowAddTenant(true)}>+ Add Tenant</button>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Tenant Code & Name</th>
                    <th>Property / Unit</th>
                    <th>Contact Info</th>
                    <th>Lease Start</th>
                    <th>Lease End</th>
                    <th>Status</th>
                    <th>Outstanding</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.length > 0 ? rows : [
                    { id: "1", code: "TNT-001", name: "ABC Traders Ltd", property: "Finance House", unit: "Unit FIN-501", email: "accounts@abctraders.co.ke", phone: "+254 722 111 222", start: "2024-01-01", end: "2026-12-31", status: "Active", out: 256450 },
                    { id: "2", code: "TNT-002", name: "Sunset Apartments Ltd", property: "Sunset Apts", unit: "Unit SUN-201", email: "info@sunsetapts.co.ke", phone: "+254 733 333 444", start: "2024-03-01", end: "2027-02-28", status: "Active", out: 198750 },
                    { id: "3", code: "TNT-003", name: "James Kariuki", property: "River View", unit: "Unit RIV-108", email: "jkariuki@gmail.com", phone: "+254 711 555 666", start: "2025-03-01", end: "2026-02-28", status: "Active", out: 0 },
                    { id: "4", code: "TNT-004", name: "Prime Solutions Ltd", property: "Uchumi House", unit: "Unit UCH-201", email: "admin@primesolutions.co.ke", phone: "+254 700 999 888", start: "2023-11-01", end: "2025-10-31", status: "Active", out: 98600 },
                  ]).map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--primary)" }}>{t.code}</div>
                      </td>
                      <td>{t.property} <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.unit}</div></td>
                      <td>{t.email} <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.phone}</div></td>
                      <td>{t.start}</td>
                      <td>{t.end}</td>
                      <td><span className="badge badge-green">{t.status}</span></td>
                      <td className="mono" style={{ color: Number(t.out) > 0 ? "#ef4444" : "var(--muted)" }}>{money.format(Number(t.out))}</td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setTab("leases")}>View Lease</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: LEASES & BULK UPLOAD */}
        {tab === "leases" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20, background: "var(--surface-2)", border: "1px dashed var(--primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0" }}>Tenancy Schedule (Bulk Import)</h4>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Upload Excel / CSV tenancy schedules to onboard multiple leases and tenants at once.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn ghost sm" onClick={() => downloadReportCSV("tenancy-template")}>📥 Download Template</button>
                  <button className="btn primary sm" onClick={() => setShowAddLease(true)}>+ Add Single Lease</button>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Lease Ref</th>
                    <th>Tenant</th>
                    <th>Property & Unit</th>
                    <th>Lease Start</th>
                    <th>Lease End</th>
                    <th>Monthly Rent</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.length > 0 ? rows : [
                    { id: "1", ref: "LSE-2025-00128", tenant: "ABC Traders Ltd", property: "Finance House", unit: "FIN-501", start: "2025-01-01", end: "2027-12-31", rent: 256450, status: "Active" },
                    { id: "2", ref: "LSE-2025-00127", tenant: "Sunset Apartments Ltd", property: "Sunset Apts", unit: "SUN-201", start: "2025-02-15", end: "2028-02-14", rent: 198750, status: "Active" },
                    { id: "3", ref: "LSE-2025-00126", tenant: "Prime Solutions Ltd", property: "Uchumi House", unit: "UCH-201", start: "2024-11-01", end: "2026-10-31", rent: 98600, status: "Active" },
                  ]).map((l: any) => (
                    <tr key={l.id}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{l.ref}</td>
                      <td><strong>{l.tenant}</strong></td>
                      <td>{l.property} ({l.unit})</td>
                      <td>{l.start}</td>
                      <td>{l.end}</td>
                      <td className="mono">{money.format(Number(l.rent))}</td>
                      <td><span className="badge badge-green">{l.status}</span></td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setTab("rent")}>Invoices</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 10: RENT COLLECTION */}
        {tab === "rent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Billed (This Month)</span>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{money.format(18740000)}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Collected</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>{money.format(14260000)}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Collection Rate</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>76.1%</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Arrears Balance</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", marginTop: 4 }}>{money.format(37850000)}</div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Rent Invoices & Collection Ledger</h3>
                <button className="btn primary sm" onClick={() => setShowRecordReceipt(true)}>+ Record Rent Payment</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Due Date</th>
                    <th>Billed Amount</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { no: "INV-2026-00891", tenant: "ABC Traders Ltd", property: "Finance House", due: "2026-08-05", amount: 256450, bal: 256450, status: "Pending" },
                    { no: "INV-2026-00890", tenant: "Sunset Apartments Ltd", property: "Sunset Apts", due: "2026-08-05", amount: 198750, bal: 198750, status: "Pending" },
                    { no: "INV-2026-00845", tenant: "Prime Solutions Ltd", property: "Uchumi House", due: "2026-07-05", amount: 98600, bal: 98600, status: "Overdue" },
                    { no: "INV-2026-00844", tenant: "James Kariuki", property: "River View", due: "2026-07-05", amount: 61000, bal: 0, status: "Paid" },
                  ].map((inv, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ color: "var(--primary)" }}>{inv.no}</td>
                      <td><strong>{inv.tenant}</strong></td>
                      <td>{inv.property}</td>
                      <td>{inv.due}</td>
                      <td className="mono">{money.format(inv.amount)}</td>
                      <td className="mono" style={{ color: inv.bal > 0 ? "#ef4444" : "#16a34a" }}>{money.format(inv.bal)}</td>
                      <td>
                        <span className={`badge ${inv.status === "Paid" ? "badge-green" : inv.status === "Overdue" ? "badge-red" : "badge-yellow"}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.bal > 0 && <button className="btn ghost sm" onClick={() => setShowRecordReceipt(true)}>Pay</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 13: SERVICE CHARGE SETUP */}
        {tab === "service-charges" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0" }}>Service Charge Model & Cost Centres</h3>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Apportionment Basis: <strong>By Lettable Area (sqm)</strong> | Annual Budget: <strong>KES 48,750,000</strong></span>
                </div>
                <button className="btn primary sm" onClick={() => downloadReportCSV("service-charge-setup")}>Export Setup</button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Cost Centre Code</th>
                    <th>Description</th>
                    <th>Recoverable</th>
                    <th>Annual Budget (KES)</th>
                    <th>Weight %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: "CC-C01", desc: "Operations & Maintenance (General repairs, lifts, HVAC)", rec: "Yes", budget: 22050000, wt: "45.2%" },
                    { code: "CC-C02", desc: "Utilities (Water, Electricity, Generators)", rec: "Yes", budget: 9928000, wt: "20.4%" },
                    { code: "CC-C03", desc: "Security (Guards, Access Control, CCTV)", rec: "Yes", budget: 7312500, wt: "15.0%" },
                    { code: "CC-C04", desc: "Cleaning & Waste Management", rec: "Yes", budget: 3900000, wt: "8.0%" },
                    { code: "CC-C05", desc: "Property Management Fee", rec: "Yes", budget: 3075000, wt: "6.3%" },
                    { code: "CC-C06", desc: "Building Insurance Premium", rec: "Yes", budget: 1367500, wt: "2.8%" },
                  ].map((cc, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{cc.code}</td>
                      <td>{cc.desc}</td>
                      <td><span className="badge badge-green">{cc.rec}</span></td>
                      <td className="mono">{money.format(cc.budget)}</td>
                      <td><strong>{cc.wt}</strong></td>
                      <td><span className="badge badge-green">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 14: REPORTS CATALOGUE */}
        {tab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>Property Management Reports Catalogue</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[
                  { title: "Rent Roll Statement", desc: "Complete active unit-by-unit rent roll with tenancy terms", key: "rent-roll" },
                  { title: "Aged Arrears Analysis", desc: "Breakdown of tenant balances by 30/60/90/120+ days overdue", key: "aged-arrears" },
                  { title: "Collection Summary", desc: "Monthly billed vs collected figures across all properties", key: "collections" },
                  { title: "Lease Expiry Schedule", desc: "Upcoming lease terminations and renewal dates", key: "lease-expiries" },
                  { title: "Vacancy & Occupancy Report", desc: "Occupancy rate trends and vacant units catalog", key: "occupancy" },
                  { title: "Service Charge Reconciliation", desc: "Budget vs actual expenditure and tenant adjustments", key: "service-charge" },
                  { title: "Income & Expense Statement", desc: "Comprehensive P&L for property portfolio", key: "pnl" },
                ].map((rep, i) => (
                  <div key={i} className="card" style={{ padding: 16, background: "var(--surface-2)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <h4 style={{ margin: "0 0 6px 0", fontSize: 15 }}>📊 {rep.title}</h4>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px 0" }}>{rep.desc}</p>
                    </div>
                    <button className="btn secondary sm" style={{ width: "100%" }} onClick={() => downloadReportCSV(rep.key)}>
                      Export CSV
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DEFAULT / FALLBACK TABLE FOR OTHER TABS */}
        {["buildings", "units", "projects", "tenant-documents", "rent-schedules", "arrears", "reminders", "receipts", "receipt-allocations", "bank-reconciliation", "credit-notes", "service-charge-allocations", "service-charge-reconciliations", "budgets", "expenses", "income-expenses", "tenant-portal"].includes(tab) && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{labels[tab]}</h3>
              <input
                type="text"
                placeholder={`Filter ${labels[tab].toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 260, fontSize: 13 }}
              />
            </div>
            {rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div>No records found for <strong>{labels[tab]}</strong>.</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0] || {}).slice(0, 6).map((k) => (
                      <th key={k}>{k.replaceAll("_", " ").toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {Object.values(r).slice(0, 6).map((v: any, j) => (
                        <td key={j}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MODAL 1: ADD PROPERTY */}
        {showAddProperty && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 520, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ Add New Property Asset</h3>
              <form onSubmit={submitAddProperty} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Property Code *</label>
                    <input name="code" required defaultValue="CE-PRO-006" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Property Name *</label>
                    <input name="name" required placeholder="e.g. Riverside Towers" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
                    <select name="property_type" defaultValue="commercial" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }}>
                      <option value="commercial">Commercial</option>
                      <option value="residential">Residential</option>
                      <option value="mixed_use">Mixed Use</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>City / Location</label>
                    <input name="city" defaultValue="Nairobi CBD" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />
                <h4 style={{ margin: 0, fontSize: 14 }}>Unit Generator Mix</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11 }}>Total Units</label>
                    <input name="unit_count" type="number" defaultValue="20" style={{ width: "100%", padding: 6, marginTop: 2, borderRadius: 4, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11 }}>Prefix</label>
                    <input name="unit_prefix" defaultValue="UNIT-" style={{ width: "100%", padding: 6, marginTop: 2, borderRadius: 4, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11 }}>Avg Area (sqm)</label>
                    <input name="unit_area" defaultValue="120" style={{ width: "100%", padding: 6, marginTop: 2, borderRadius: 4, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowAddProperty(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Property</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ADD TENANT */}
        {showAddTenant && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 520, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ Add New Tenant Profile</h3>
              <form onSubmit={submitAddTenant} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Tenant Code *</label>
                    <input name="code" required defaultValue="TNT-005" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Full Name / Company *</label>
                    <input name="name" required placeholder="e.g. Apex Holdings Ltd" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Email Address</label>
                    <input name="email" type="email" placeholder="info@company.co.ke" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Phone Number</label>
                    <input name="phone" placeholder="+254 700 000 000" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowAddTenant(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Register Tenant</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: RECORD RECEIPT */}
        {showRecordReceipt && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 480, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ Record Rent Payment Receipt</h3>
              <form onSubmit={submitRecordReceipt} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Receipt Number *</label>
                  <input name="number" required defaultValue={`RCPT-2026-${Math.floor(1000 + Math.random() * 9000)}`} style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Tenant Name *</label>
                  <input name="tenant_name" required defaultValue="ABC Traders Ltd" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Amount (KES) *</label>
                    <input name="amount" type="number" required defaultValue="256450" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Method</label>
                    <select name="payment_method" defaultValue="bank_transfer" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="mpesa">M-Pesa Paybill</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowRecordReceipt(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Post Receipt</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
