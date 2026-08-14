"use client";

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
  const activeCharges = charges.filter((charge) => charge.is_active !== false).length;
  const method = charges[0]?.method ?? "—";
  const totalArea = (charges[0]?.metadata as Record<string, unknown> | undefined)?.total_lettable_area;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ViewToolbar
        title="Service Charge Schemes"
        subtitle="Configure cost centres for the selected property, then apportion or reconcile them"
        search={search}
        onSearch={setSearch}
        placeholder="Search cost centres…"
      >
        <button className="btn primary sm" onClick={onAdd}>+ Set Up Charge</button>
      </ViewToolbar>

      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>Selected property model</h4>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Apportionment basis: <strong>{String(method).replace(/_/g, " ")}</strong> · Annual budget: <strong>{kM(totalBudget)}</strong>
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone="blue">{kN(activeCharges)} active</Badge>
            <Badge>{totalArea === undefined ? "Area not set" : `${kN(totalArea)} m² lettable`}</Badge>
          </div>
        </div>
      </div>

      <Panel
        title="Cost Centres"
        action={(
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn ghost sm" onClick={() => setTab("service-charge-allocations")}>View allocations →</button>
            <button className="btn ghost sm" onClick={() => setTab("service-charge-reconciliations")}>View reconciliations →</button>
          </div>
        )}
      >
        <ListState loading={loading} empty={charges.length === 0} emptyTitle="No cost centres found" emptyDesc="Set up a service charge scheme for this property to begin allocation and reconciliation.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Cost Centre</th>
                  <th>Description</th>
                  <th>Recovery</th>
                  <th>Annual Budget</th>
                  <th>Share</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={String(charge.id)}>
                    <td style={{ fontWeight: 700 }}>{String(charge.name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(charge.description ?? "—")}</td>
                    <td><Badge tone={charge.is_recoverable !== false ? "green" : "gray"}>{charge.is_recoverable !== false ? "Recoverable" : "Direct cost"}</Badge></td>
                    <td className="mono font-semibold">{kM(charge.annual_budget)}</td>
                    <td className="mono">{totalBudget > 0 ? pct(Number(charge.annual_budget ?? 0), totalBudget) : 0}%</td>
                    <td><StatusPill value={charge.is_active !== false ? "Active" : "Inactive"} /></td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <button className="btn ghost sm" aria-label="Allocate" onClick={() => onAllocate(charge)}>Generate allocations</button>
                        <button className="btn ghost sm" onClick={() => onReconcile(charge)}>Start reconciliation</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </div>
  );
}
