"use client";

import { KpiCard, KpiStrip, number, Panel, StatusPill, EmptyState } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtMoney } from "../../utils/sales.utils";
import { DataTable, FilterChips, TableChrome } from "../SalesUiComponents";
import { SavedViews } from "../SavedViews";

function toneForBuyer(s: string): Tone {
  if (s === "active" || s === "completed") return "green";
  if (s === "qualified") return "blue";
  if (s === "lead") return "yellow";
  if (s === "cancelled") return "red";
  return "gray";
}

export function LeadsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openRegisterBuyer,
  quickTransition,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openRegisterBuyer: () => void;
  quickTransition: (row: Row, target: string) => void;
}) {
  const total = rows.length;
  const newCount = countBy(rows, ["lead"]);
  const qualifiedCount = countBy(rows, ["qualified"]);
  const activeCount = countBy(rows, ["active"]);
  const completedCount = countBy(rows, ["completed"]);
  const cancelledCount = countBy(rows, ["cancelled"]);

  const funnelStages = [
    { label: "New", count: newCount, color: "var(--color-info)" },
    { label: "Contacted", count: 0, color: "#0891b2" },
    { label: "Site Visit", count: 0, color: "var(--color-violet)" },
    { label: "Interested", count: qualifiedCount, color: "var(--color-amber)" },
    { label: "Reserved", count: activeCount, color: "var(--color-orange)" },
    { label: "Converted", count: completedCount, color: "var(--color-success)" },
    { label: "Lost", count: cancelledCount, color: "var(--color-danger-strong)" },
  ];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <>
      <KpiStrip cols={7}>
        <KpiCard icon="📊" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total Leads" value={number.format(total)} sub="All pipeline leads" onClick={() => setStatus("")} />
        <KpiCard icon="🆕" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="New" value={number.format(newCount)} sub="Awaiting first contact" onClick={() => setStatus(status === "lead" ? "" : "lead")} />
        <KpiCard icon="📞" iconBg="var(--color-sky-bg)" iconColor="#0891b2" label="Contacted" value="0" sub="No data available" />
        <KpiCard icon="🏠" iconBg="var(--color-violet-bg)" iconColor="var(--color-violet)" label="Site Visits" value="0" sub="No data available" />
        <KpiCard icon="⭐" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber)" label="Interested" value={number.format(qualifiedCount)} sub="Qualified leads" onClick={() => setStatus(status === "qualified" ? "" : "qualified")} />
        <KpiCard icon="✅" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Converted" value={number.format(completedCount)} sub="Closed deals" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
        <KpiCard icon="❌" iconBg="var(--color-red-bg)" iconColor="var(--color-danger-strong)" label="Lost" value={number.format(cancelledCount)} sub="Dropped leads" onClick={() => setStatus(status === "cancelled" ? "" : "cancelled")} />
      </KpiStrip>

      <Panel title="Lead Funnel">
        <div style={{ padding: 18 }}>
          {funnelStages.map((stage) => (
            <div key={stage.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span>{stage.label}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{number.format(stage.count)}</span>
              </div>
              <div style={{ background: "var(--color-surface-alt)", borderRadius: 4, height: 22, overflow: "hidden" }}>
                <div style={{ background: stage.color, height: "100%", width: `${(stage.count / maxFunnel) * 100}%`, borderRadius: 4, transition: "width 0.3s ease", minWidth: stage.count > 0 ? 2 : 0 }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Leads Pipeline" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search name, phone, agent…"
          chips={<FilterChips options={[{ value: "lead", label: "New" }, { value: "qualified", label: "Interested" }, { value: "active", label: "Reserved" }, { value: "completed", label: "Converted" }, { value: "cancelled", label: "Lost" }]} value={status as "lead" | "qualified" | "active" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={<div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}><SavedViews scope="leads" current={{ status, search }} onApply={(f) => { setStatus(f.status); setSearch(f.search); }} /><button className="btn primary sm" onClick={openRegisterBuyer}>+ New Lead</button></div>}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🧲" title="No leads found" description="Register your first lead to start tracking the sales pipeline." action={<button className="btn primary sm" onClick={openRegisterBuyer}>+ New Lead</button>} />
          ) : (
            <DataTable headers={["Name", "Phone", "Agent", "Budget", "Stage", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><strong style={{ fontSize: 12 }}>{String(r.full_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12 }}>{String(r.phone ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.agent_name ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.budget ? fmtMoney(r.budget) : "—"}</td>
                  <td><StatusPill value={String(r.status ?? "")} tone={toneForBuyer(String(r.status ?? ""))} /></td>
                  <td>
                    {String(r.status) === "lead" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "qualified")}>Qualify</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                    {String(r.status) === "qualified" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "active")}>Reserve</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                    {String(r.status) === "active" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "completed")}>Convert</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}
