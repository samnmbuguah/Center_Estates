"use client";

import React, { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { salesNav } from "@/lib/module-nav";

export type SalesTab =
  | "overview"
  | "inventory"
  | "buyers"
  | "sales"
  | "installments"
  | "payments"
  | "site-visits"
  | "commissions"
  | "performance"
  | "reports"
  | "documents"
  | "audit-events";

const tabs: Record<SalesTab, string> = {
  overview: "Dashboard",
  inventory: "Projects & Units",
  buyers: "Buyers Registry",
  sales: "Sales Pipeline",
  installments: "Installment Schedules",
  payments: "Payments & Verification",
  "site-visits": "Site Visits (Sales Clerk)",
  commissions: "Agent Commissions",
  performance: "Agent Performance",
  reports: "Sales Reports",
  documents: "Legal Documents",
  "audit-events": "Audit Trail",
};

const cash = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

interface SalesWorkspaceProps {
  initialTab?: SalesTab;
}

export function SalesWorkspace({ initialTab = "overview" }: SalesWorkspaceProps) {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<SalesTab>(initialTab);
  const [dashboard, setDashboard] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showRegisterBuyer, setShowRegisterBuyer] = useState(false);
  const [showRecordVisit, setShowRecordVisit] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);

  const loadVersion = useRef(0);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    const isAnalytics = tab === "performance" || tab === "reports";
    const path = tab === "overview"
      ? "/sales/dashboard/"
      : isAnalytics
      ? "/sales/analytics/"
      : `/sales/${tab}/?search=${encodeURIComponent(search)}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (res.ok) {
        const data = await res.json();
        if (version !== loadVersion.current) return;
        if (tab === "overview") setDashboard(data);
        else if (tab === "performance") setRows(data.agentPerformance || []);
        else if (tab === "reports") setRows(data.reports || []);
        else setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch (e) {
      setError("Unable to connect to property sales service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, org]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitRegisterBuyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/buyers/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);

    if (res.ok) {
      setShowRegisterBuyer(false);
      setTab("buyers");
      loadData();
    } else {
      setError("Buyer registration failed. ID or reference may already exist.");
    }
  }

  async function verifyPayment(row: any) {
    if (!window.confirm(`Verify payment ${row.reference} for ${cash.format(Number(row.amount))}?`)) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/payments/${row.id}/verify/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: "{}",
    }, org);

    if (res.ok) {
      loadData();
    } else {
      setError("Payment verification failed.");
    }
  }

  async function downloadReportCSV(key: string) {
    const res = await apiFetch(`/sales/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report generation failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = dashboard?.kpis || {
    availableUnits: 142,
    reservedUnits: 38,
    soldUnits: 284,
    salesValue: "485000000",
    pipelineDeals: 42,
    verifiedPayments: "128400000",
    pendingPayments: 6,
    activeBuyers: 320,
    siteVisits: 84,
    pendingCommissions: "14200000",
  };

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Revenue & Property Sales Workspace"
      title="Sales Management"
      subtitle="Multi-project unit sales, buyer onboarding, payments, site visits & commissions."
      accent="#ea580c"
      groups={salesNav}
      activeId={tab}
      onSelect={(id) => { setSearch(""); setTab(id as SalesTab); }}
      contextLabel="View Scope"
      contextValue={tabs[tab]}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>📅 {todayStr}</span>
          <button className="btn primary sm" onClick={() => setShowRegisterBuyer(true)}>+ Register Buyer</button>
        </div>
      }
    >
      <div className="sales-workspace" style={{ padding: "16px 24px" }}>
        {error && (
          <div className="card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", padding: 12, borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#ef4444", fontSize: 13 }}>⚠️ {error}</span>
            <button className="btn ghost sm" onClick={loadData}>Retry</button>
          </div>
        )}

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("inventory")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Available Units</span>
                  <span style={{ fontSize: 20 }}>🏠</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.availableUnits}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>{kpis.reservedUnits} reserved · {kpis.soldUnits} sold</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("sales")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Sales Pipeline Value</span>
                  <span style={{ fontSize: 20 }}>💼</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{cash.format(Number(kpis.salesValue))}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{kpis.pipelineDeals} active deals</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("payments")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Verified Collections</span>
                  <span style={{ fontSize: 20 }}>💳</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>{cash.format(Number(kpis.verifiedPayments))}</div>
                <div style={{ fontSize: 12, color: "#eab308", marginTop: 4 }}>{kpis.pendingPayments} awaiting verification</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("buyers")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Active Buyers</span>
                  <span style={{ fontSize: 20 }}>👥</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.activeBuyers}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>{kpis.siteVisits} recorded site visits</div>
              </div>
            </div>

            {/* Dashboard Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Recent Sales Pipeline</h3>
                    <button className="btn ghost sm" onClick={() => setTab("sales")}>View All Sales →</button>
                  </div>
                  {(dashboard?.recentSales || []).length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Sale Ref</th>
                          <th>Buyer</th>
                          <th>Project</th>
                          <th>Agreed Price</th>
                          <th>Paid Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboard?.recentSales || []).map((s: any, idx: number) => (
                          <tr key={idx}>
                            <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{s.reference}</td>
                            <td><strong>{s.buyer_name || s.buyer?.full_name || "—"}</strong></td>
                            <td>{s.project_name || "—"}</td>
                            <td className="mono">{cash.format(Number(s.agreed_price || 0))}</td>
                            <td className="mono" style={{ color: "#16a34a" }}>{cash.format(Number(s.paid_amount || 0))}</td>
                            <td><span className={`badge ${s.status === "completed" ? "badge-green" : "badge-yellow"}`}>{s.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)" }}>No recent sales recorded.</div>
                  )}
                </div>

              </div>

              {/* Right Column: Actions & Quick Tools */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Sales Actions</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn primary" style={{ textAlign: "left" }} onClick={() => setShowRegisterBuyer(true)}>
                      👥 Register New Buyer
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("site-visits")}>
                      📍 Record Site Visit (Clerk)
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("payments")}>
                      💳 Verify Pending Payments
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("commissions")}>
                      % Agent Commissions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OTHER TABS DATA TABLE */}
        {tab !== "overview" && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{tabs[tab]}</h3>
              <input
                type="text"
                placeholder={`Search ${tabs[tab].toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 280, fontSize: 13 }}
              />
            </div>

            {rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div>No records currently listed in <strong>{tabs[tab]}</strong>.</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0] || {}).slice(0, 7).map((k) => (
                      <th key={k}>{k.replaceAll("_", " ").toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {Object.values(r).slice(0, 7).map((v: any, j) => (
                        <td key={j}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MODAL: REGISTER BUYER */}
        {showRegisterBuyer && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 520, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ Register Buyer Profile</h3>
              <form onSubmit={submitRegisterBuyer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Buyer Ref *</label>
                    <input name="reference" required defaultValue="BUY-2026-0043" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Full Legal Name *</label>
                    <input name="full_name" required placeholder="e.g. Apex Holdings Ltd" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Email Address</label>
                    <input name="email" type="email" placeholder="buyer@domain.co.ke" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Phone Number</label>
                    <input name="phone" placeholder="+254 700 000 000" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>National / Company ID</label>
                    <input name="id_number" required placeholder="12345678" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Financing Type</label>
                    <select name="financing_type" defaultValue="self" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }}>
                      <option value="self">Self-Financed</option>
                      <option value="bank">Bank-Financed</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowRegisterBuyer(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Register Buyer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
