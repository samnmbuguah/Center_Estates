"use client";

import { useState } from "react";
import { Badge, Panel, StatusPill } from "@/components/module-ui";
import { ListState, ViewToolbar } from "../PropertyToolbar";
import type { PropertyTab, Row, ServiceChargeRow } from "../../types/property.types";
import { kM, kN, pct } from "../../utils/property.utils";

export function ServiceChargesView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  setTab,
  onAdd,
  onAllocate,
  onReconcile,
}: {
  rows?: Row[];
  loading?: boolean;
  search?: string;
  setSearch: (value: string) => void;
  setTab: (tab: PropertyTab) => void;
  onAdd: () => void;
  onAllocate: (row: ServiceChargeRow) => void;
  onReconcile: (row: ServiceChargeRow) => void;
}) {
  const charges = rows as ServiceChargeRow[];
  const totalBudget = charges.reduce((sum, charge) => sum + Number(charge.annual_budget ?? 0), 0);
  const monthlyPool = totalBudget / 12;
  const activeCharges = charges.filter((charge) => charge.is_active !== false).length;
  const method = charges[0]?.method ?? "area";
  const totalArea = (charges[0]?.metadata as Record<string, unknown> | undefined)?.total_lettable_area;
  const [selectedScheme, setSelectedScheme] = useState<ServiceChargeRow | null>(null);

  const filteredCharges = charges.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      String(c.name ?? "").toLowerCase().includes(term) ||
      String(c.description ?? "").toLowerCase().includes(term) ||
      String(c.method ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ViewToolbar
        title="Service Charge Schemes"
        subtitle="Manage cost centre budgets, unit floor-area apportionments, and expense reconciliations"
        search={search}
        onSearch={setSearch}
        placeholder="Search schemes or cost centres…"
      >
        <button className="btn primary sm" onClick={onAdd}>+ Set Up Charge</button>
      </ViewToolbar>

      {/* Visual Setup & Accounting Flow Stepper */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-secondary)", marginBottom: 12 }}>
          Service Charge Operational Workflow
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>Step 1 · Scheme Setup</span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Define Cost Centres & Budget</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Area or equal-share basis</span>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>Step 2 · Unit Floor Areas</span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Verify Unit m² / sqft</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Enforce positive area weights</span>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>Step 3 · Apportionment</span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Generate Unit Allocations</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Exact 100.00% penny absorption</span>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>Step 4 · Invoicing</span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Monthly Invoicing Run</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Auto-inject onto tenant bills</span>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#0d9488" }}>Step 5 · Reconciliation</span>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Audit vs. Actual OPEX</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Prorated variance & certificates</span>
          </div>
        </div>
      </div>

      {/* Property Scheme Summary & Health Card */}
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Property Cost Pool Overview</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Default method: <strong style={{ color: "var(--text)" }}>{String(method).replace(/_/g, " ").toUpperCase()}</strong> · Annual budget: <strong style={{ color: "var(--text)" }}>{kM(totalBudget)}</strong> · Monthly billable pool: <strong style={{ color: "var(--text)" }}>{kM(monthlyPool)}</strong>
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone="blue">{kN(activeCharges)} Active Schemes</Badge>
            <Badge tone="green">{kN(charges.length)} Cost Centres</Badge>
            <Badge>{totalArea === undefined ? "Floor area active" : `${kN(totalArea)} m² lettable`}</Badge>
          </div>
        </div>
      </div>

      <Panel
        title="Cost Centres & Recoverable Schemes"
        action={(
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn primary sm"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "billing");
                url.searchParams.set("billing_type", "service_charge");
                window.history.pushState(null, "", url.toString());
                setTab("billing");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              ⚡ Bulk Bill Service Charge →
            </button>
            <button className="btn ghost sm" onClick={() => setTab("service-charge-allocations")}>View Allocations Ledger →</button>
            <button className="btn ghost sm" onClick={() => setTab("service-charge-reconciliations")}>View Reconciliations →</button>
          </div>
        )}
      >
        <ListState loading={loading} empty={filteredCharges.length === 0} emptyTitle="No cost centres found" emptyDesc="Set up a service charge scheme for this property to begin allocation and reconciliation.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Cost Centre Scheme</th>
                  <th>Apportionment Basis</th>
                  <th>Annual Budget</th>
                  <th>Monthly Pool</th>
                  <th>Budget Share</th>
                  <th>Allocated Units</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.map((charge) => {
                  const allocCount = Number(charge.allocation_count ?? (Array.isArray(charge.allocations) ? charge.allocations.length : 0));
                  return (
                    <tr key={String(charge.id)}>
                      <td>
                        <strong style={{ fontSize: 13, color: "var(--text)" }}>{String(charge.name ?? "—")}</strong>
                        {Boolean(charge.description) && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{String(charge.description)}</div>}
                      </td>
                      <td>
                        <Badge tone={charge.method === "area" ? "blue" : "purple"}>
                          {String(charge.method === "area" ? "Floor Area (m²)" : charge.method === "equal" ? "Equal Share" : "Fixed Amount")}
                        </Badge>
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>{kM(charge.annual_budget)}</td>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 700 }}>{kM(Number(charge.annual_budget ?? 0) / 12)}</td>
                      <td className="mono" style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{totalBudget > 0 ? pct(Number(charge.annual_budget ?? 0), totalBudget) : 0}%</td>
                      <td>
                        {allocCount > 0 ? (
                          <Badge tone="green">✓ {allocCount} Units Apportioned</Badge>
                        ) : (
                          <Badge tone="yellow">Pending Apportionment</Badge>
                        )}
                      </td>
                      <td><StatusPill value={charge.is_active !== false ? "Active" : "Inactive"} /></td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            className="btn primary sm"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => onAllocate(charge)}
                          >
                            ⚡ Generate Allocations
                          </button>
                          <button
                            className="btn ghost sm"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => setSelectedScheme(charge)}
                          >
                            📊 View Schedule
                          </button>
                          <button
                            className="btn ghost sm"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => onReconcile(charge)}
                          >
                            🔄 Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      {/* Scheme Detail & Schedule Breakdown Modal */}
      {selectedScheme && (
        <div className="fc-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="fc-modal-card" style={{ background: "var(--surface)", borderRadius: 12, maxWidth: 680, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{selectedScheme.name} — Apportionment Schedule</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                  Basis: {String(selectedScheme.method).toUpperCase()} · Annual Budget: {kM(selectedScheme.annual_budget)}
                </p>
              </div>
              <button className="btn ghost sm" onClick={() => setSelectedScheme(null)}>✕</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 800 }}>ANNUAL POOL</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{kM(selectedScheme.annual_budget)}</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 800 }}>MONTHLY CHARGE POOL</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>{kM(Number(selectedScheme.annual_budget ?? 0) / 12)}</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 800 }}>EFFECTIVE DATE</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{String(selectedScheme.starts_on ?? "Active")}</div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                To view or export the full unit-by-unit allocation matrix with exact percentage ratios, visit the <strong>Charge Allocations</strong> tab or click Export Schedule below.
              </p>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-sunken)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <button
                className="btn ghost sm"
                onClick={() => {
                  setSelectedScheme(null);
                  setTab("service-charge-allocations");
                }}
              >
                Go to Allocations Ledger →
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn primary sm"
                  onClick={() => {
                    onAllocate(selectedScheme);
                    setSelectedScheme(null);
                  }}
                >
                  ⚡ Re-calculate Allocations
                </button>
                <button className="btn ghost sm" onClick={() => setSelectedScheme(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
