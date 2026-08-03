"use client";

import React, { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { valuationNav } from "@/lib/module-nav";

export type ValuationTab =
  | "overview"
  | "instructions"
  | "inspections"
  | "comparables"
  | "draft-reports"
  | "final-reports"
  | "invoices"
  | "payments"
  | "clients"
  | "analytics"
  | "reports"
  | "audit-events";

const names: Record<ValuationTab, string> = {
  overview: "Command Center (Overview)",
  instructions: "Valuation Instructions",
  inspections: "Site Inspections & Evidence",
  comparables: "Comparable Sales Evidence",
  "draft-reports": "Draft Valuation Reports",
  "final-reports": "Final Signed Reports",
  invoices: "Client Invoicing",
  payments: "Fee Collections",
  clients: "Lenders & Clients Vault",
  analytics: "Valuation Analytics & Turnaround",
  reports: "Reports Catalogue",
  "audit-events": "Audit Trail",
};

const cash = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

interface ValuationWorkspaceProps {
  initialTab?: ValuationTab;
}

export function ValuationWorkspace({ initialTab = "overview" }: ValuationWorkspaceProps) {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<ValuationTab>(initialTab);
  const [dash, setDash] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const loadVersion = useRef(0);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    const isAnalytics = tab === "analytics" || tab === "reports";
    const path = tab === "overview"
      ? "/valuation/dashboard/"
      : isAnalytics
      ? "/valuation/analytics/"
      : `/valuation/${tab}/?search=${encodeURIComponent(search)}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (res.ok) {
        const data = await res.json();
        if (version !== loadVersion.current) return;
        if (tab === "overview") setDash(data);
        else if (tab === "analytics") setRows(data.teamPerformance || []);
        else if (tab === "reports") setRows(data.reports || []);
        else setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch (e) {
      setError("Unable to connect to valuation tracker service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, org]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (showAddModal && org) {
      apiFetch("/valuation/clients/", {}, org)
        .then((r) => (r.ok ? r.json() : []))
        .then(setClients);
    }
  }, [showAddModal, org]);

  async function submitRegisterInstruction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(form.entries()),
      valuer: session?.user.id,
      status: "new",
    };

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/valuation/instructions/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);

    if (res.ok) {
      setShowAddModal(false);
      setTab("instructions");
      loadData();
    } else {
      setError("Valuation instruction creation failed. Check reference number.");
    }
  }

  const kpis = dash?.kpis || {
    activeInstructions: 24,
    dueThisWeek: 5,
    inspectionsPending: 8,
    draftsInReview: 6,
    finalReports: 142,
    outstanding: "8400000",
    revenue: "42600000",
  };

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation Tracker"
      eyebrow="Property Valuation Workspace"
      title="Valuation Management"
      subtitle="Valuation instructions, site inspections, comparable sales, draft reports & fee invoicing."
      accent="#0891b2"
      groups={valuationNav}
      activeId={tab}
      onSelect={(id) => { setSearch(""); setTab(id as ValuationTab); }}
      contextLabel="View Scope"
      contextValue={names[tab]}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>📅 {todayStr}</span>
          <button className="btn primary sm" onClick={() => setShowAddModal(true)}>+ New Instruction</button>
        </div>
      }
    >
      <div className="valuation-workspace" style={{ padding: "16px 24px" }}>
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
              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("instructions")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Active Instructions</span>
                  <span style={{ fontSize: 20 }}>📐</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.activeInstructions}</div>
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{kpis.dueThisWeek} due within 7 days</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("inspections")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Site Inspections</span>
                  <span style={{ fontSize: 20 }}>📍</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.inspectionsPending}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>Scheduled or in progress</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("draft-reports")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Drafts in Review</span>
                  <span style={{ fontSize: 20 }}>📝</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#eab308" }}>{kpis.draftsInReview}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{kpis.finalReports} final reports issued</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("invoices")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Outstanding Fees</span>
                  <span style={{ fontSize: 20 }}>💰</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}>{cash.format(Number(kpis.outstanding))}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{cash.format(Number(kpis.revenue))} collected</div>
              </div>
            </div>

            {/* Dashboard Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Recent Valuation Instructions</h3>
                    <button className="btn ghost sm" onClick={() => setTab("instructions")}>View All Instructions →</button>
                  </div>
                  {(dash?.recentInstructions || []).length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Instruction Ref</th>
                          <th>Client</th>
                          <th>Property</th>
                          <th>Valuation Type</th>
                          <th>Due Date</th>
                          <th>Fee</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dash?.recentInstructions || []).map((v: any, idx: number) => (
                          <tr key={idx}>
                            <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{v.reference}</td>
                            <td><strong>{v.client_name || v.client?.name || "—"}</strong></td>
                            <td>{v.property_description || "—"}</td>
                            <td>{v.valuation_type || "—"}</td>
                            <td>{v.due_on}</td>
                            <td className="mono">{cash.format(Number(v.quoted_fee || 0))}</td>
                            <td><span className="badge badge-blue">{v.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)" }}>No recent valuation instructions recorded.</div>
                  )}
                </div>

              </div>

              {/* Right Column: Actions & Quick Tools */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Valuation Actions</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn primary" style={{ textAlign: "left" }} onClick={() => setShowAddModal(true)}>
                      📐 New Instruction Intake
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("inspections")}>
                      📍 Site Inspection & Photos
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("comparables")}>
                      📊 Comparable Evidence Registry
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("draft-reports")}>
                      📝 Review Draft Reports
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("invoices")}>
                      💰 Issue Fee Invoices
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
              <h3 style={{ margin: 0, fontSize: 16 }}>{names[tab]}</h3>
              <input
                type="text"
                placeholder={`Search ${names[tab].toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 280, fontSize: 13 }}
              />
            </div>

            {rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📐</div>
                <div>No records currently listed in <strong>{names[tab]}</strong>.</div>
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

        {/* MODAL: REGISTER INSTRUCTION */}
        {showAddModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 520, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ New Valuation Instruction Intake</h3>
              <form onSubmit={submitRegisterInstruction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Instruction Ref *</label>
                    <input name="reference" required defaultValue="VAL-2026-0186" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Client *</label>
                    <select name="client" required style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }}>
                      <option value="">Select client / lender...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Property Description & L.R. No *</label>
                  <input name="property_description" required placeholder="e.g. Commercial Complex L.R. 209/1844" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Valuation Type *</label>
                    <input name="valuation_type" required defaultValue="Commercial Asset" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Purpose *</label>
                    <input name="purpose" required defaultValue="Mortgage Security" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Instruction Date *</label>
                    <input name="instructed_on" type="date" required defaultValue="2026-08-02" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Due Date *</label>
                    <input name="due_on" type="date" required defaultValue="2026-08-15" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Quoted Fee (KES) *</label>
                    <input name="quoted_fee" type="number" required defaultValue="450000" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Priority</label>
                    <select name="priority" defaultValue="normal" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }}>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Create Instruction</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
