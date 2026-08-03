"use client";

import React, { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { tenderNav } from "@/lib/module-nav";

export type TenderTab =
  | "overview"
  | "tenders"
  | "requirements"
  | "decisions"
  | "tasks"
  | "company-documents"
  | "proposals"
  | "financial-items"
  | "reviews"
  | "submissions"
  | "outcomes"
  | "reports"
  | "audit-events";

const labels: Record<TenderTab, string> = {
  overview: "Dashboard",
  tenders: "Invitations (Step 1)",
  requirements: "AI Analysis (Step 2)",
  decisions: "Bid / No-Bid (Step 3)",
  tasks: "Planning (Step 4)",
  "company-documents": "Company Vault (Step 5)",
  proposals: "Technical Proposal (Step 6)",
  "financial-items": "Financial BOQ (Step 7)",
  reviews: "Review & Approval (Step 8)",
  submissions: "Packaging & Submissions (Step 9-10)",
  outcomes: "Awards & Regrets (Step 11)",
  reports: "Tender Reports",
  "audit-events": "Audit Trail",
};

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

interface TenderWorkspaceProps {
  initialTab?: TenderTab;
}

export function TenderWorkspace({ initialTab = "overview" }: TenderWorkspaceProps) {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<TenderTab>(initialTab);
  const [dash, setDash] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
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

    const path = tab === "overview"
      ? "/tender/dashboard/"
      : tab === "reports"
      ? "/tender/analytics/"
      : `/tender/${tab}/?search=${encodeURIComponent(search)}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (res.ok) {
        const data = await res.json();
        if (version !== loadVersion.current) return;
        if (tab === "overview") setDash(data);
        else if (tab === "reports") setRows(data.reports || []);
        else setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch (e) {
      setError("Unable to connect to tender intelligence service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, org]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitRegisterTender(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/tenders/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);

    if (res.ok) {
      setShowAddModal(false);
      setTab("tenders");
      loadData();
    } else {
      setError("Tender registration failed. Check reference number.");
    }
  }

  async function downloadReportCSV(key: string) {
    const res = await apiFetch(`/tender/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report generation failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tender-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = dash?.kpis || {
    activeTenders: 12,
    dueThisWeek: 3,
    pipelineValue: "1450000000",
    submitted: 28,
    pendingTasks: 18,
    expiringDocuments: 4,
  };

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender Management"
      eyebrow="Tender Intelligence Workspace"
      title="Tender Management"
      subtitle="Controlled 11-step bid production from invitation & AI analysis to packaging and award."
      accent="#7c3aed"
      groups={tenderNav}
      activeId={tab}
      onSelect={(id) => { setSearch(""); setTab(id as TenderTab); }}
      contextLabel="View Scope"
      contextValue={labels[tab]}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>📅 {todayStr}</span>
          <button className="btn primary sm" onClick={() => setShowAddModal(true)}>+ Register Invitation</button>
        </div>
      }
    >
      <div className="tender-workspace" style={{ padding: "16px 24px" }}>
        {error && (
          <div className="card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", padding: 12, borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#ef4444", fontSize: 13 }}>⚠️ {error}</span>
            <button className="btn ghost sm" onClick={loadData}>Retry</button>
          </div>
        )}

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, width: "100%" }}>
              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("tenders")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Active Tenders</span>
                  <span style={{ fontSize: 20 }}>📋</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.activeTenders}</div>
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{kpis.dueThisWeek} due within 7 days</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("tenders")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Pipeline Value</span>
                  <span style={{ fontSize: 20 }}>💼</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{money.format(Number(kpis.pipelineValue))}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{kpis.submitted} submitted bids</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("tasks")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Pending Tasks</span>
                  <span style={{ fontSize: 20 }}>☑</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{kpis.pendingTasks}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>Across active bid plans</div>
              </div>

              <div className="card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setTab("company-documents")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Expiring Documents</span>
                  <span style={{ fontSize: 20 }}>📄</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#eab308" }}>{kpis.expiringDocuments}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Vault certificates & permits</div>
              </div>
            </div>

            {/* Dashboard Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Recent Tender Invitations</h3>
                    <button className="btn ghost sm" onClick={() => setTab("tenders")}>View All Invitations →</button>
                  </div>
                  {(dash?.recentTenders || []).length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Tender Ref</th>
                          <th>Title</th>
                          <th>Client</th>
                          <th>Deadline</th>
                          <th>Value</th>
                          <th>Readiness</th>
                          <th>Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dash?.recentTenders || []).map((t: any, idx: number) => (
                          <tr key={idx}>
                            <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{t.reference}</td>
                            <td><strong>{t.title}</strong></td>
                            <td>{t.client}</td>
                            <td>{t.submission_deadline}</td>
                            <td className="mono">{money.format(Number(t.estimated_value || 0))}</td>
                            <td><span className="badge badge-green">{t.readiness_score || 0}%</span></td>
                            <td><span className="badge">{t.stage}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)" }}>No recent tender invitations recorded.</div>
                  )}
                </div>

              </div>

              {/* Right Column: Actions & Quick Tools */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Tender Pipeline Workflow</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn primary" style={{ textAlign: "left" }} onClick={() => setShowAddModal(true)}>
                      📋 Step 1: Register Tender Invitation
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("requirements")}>
                      ✨ Step 2: AI Requirement Analysis
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("decisions")}>
                      ⚖ Step 3: Bid / No-Bid Decision
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("tasks")}>
                      📅 Step 4: Bid Planning & Tasks
                    </button>
                    <button className="btn secondary" style={{ textAlign: "left" }} onClick={() => setTab("company-documents")}>
                      📁 Step 5: Company Vault Documents
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
              <h3 style={{ margin: 0, fontSize: 16 }}>{labels[tab]}</h3>
              <input
                type="text"
                placeholder={`Filter ${labels[tab].toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", width: 280, fontSize: 13 }}
              />
            </div>

            {rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📑</div>
                <div>No records currently listed in <strong>{labels[tab]}</strong>.</div>
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

        {/* MODAL: REGISTER INVITATION */}
        {showAddModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 520, background: "var(--surface)", padding: 24 }}>
              <h3 style={{ margin: "0 0 16px 0" }}>+ Register Tender Invitation (Step 1)</h3>
              <form onSubmit={submitRegisterTender} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Tender Reference *</label>
                    <input name="reference" required defaultValue="TND-2026-0049" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
                    <input name="category" defaultValue="Civil Engineering" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Tender Title *</label>
                  <input name="title" required placeholder="e.g. Design & Build of Water Treatment Plant" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Procuring Entity / Client *</label>
                  <input name="client" required placeholder="e.g. Water Resources Authority" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Submission Deadline *</label>
                    <input name="submission_deadline" type="datetime-local" required defaultValue="2026-08-30T14:00" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Estimated Value (KES)</label>
                    <input name="estimated_value" type="number" defaultValue="450000000" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Invitation</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
