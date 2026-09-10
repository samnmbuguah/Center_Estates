"use client";

import { useMemo } from "react";
import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Dashboard } from "../../types/sales.types";
import { fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, ProgressBar } from "../SalesUiComponents";

export function PerformanceView({ dashboard }: { dashboard: Dashboard }) {
  const agents = dashboard.agentPerformance ?? [];
  const exposure = dashboard.installmentExposure ?? {};
  const ranked = useMemo(
    () => [...agents].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)),
    [agents],
  );
  const deals = sumBy(agents, "deals");
  const completed = sumBy(agents, "completed");
  const cancelled = sumBy(agents, "cancelled");
  const valueSold = sumBy(agents, "value");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🧑‍💼" iconBg="#e0e7ff" iconColor="#4f46e5" label="Agents" value={number.format(agents.length)} sub="With recorded sales" />
        <KpiCard icon="🏷️" iconBg="#e0f2fe" iconColor="#0284c7" label="Units Sold" value={number.format(completed)} sub={`${number.format(deals)} total deals`} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Value Sold" value={fmtMoney(valueSold)} sub="Aggregate agreed price" />
        <KpiCard icon="✖️" iconBg="#fee2e2" iconColor="#b91c1c" label="Cancellations" value={number.format(cancelled)} sub="Lost pipeline deals" />
        <KpiCard icon="⚠️" iconBg="#fef3c7" iconColor="#92400e" label="Overdue Exposure" value={fmtMoney(exposure.outstanding)} sub={`${number.format(Number(exposure.count ?? 0))} overdue installments`} />
      </KpiStrip>

      <Panel title="Agent Performance" badge={agents.length}>
        {agents.length === 0 ? (
          <EmptyState icon="🧑‍💼" title="No agent performance data" description="Once agents close sales, their units, value and conversion appear here." />
        ) : (
          <DataTable headers={["Rank", "Agent", "Units Sold", "Value Sold", "Conversion", "Avg Time to Close", "Cancellations", "Status"]}>
            {ranked.map((r, i) => {
              const d = Number(r.deals ?? 0);
              const c = Number(r.completed ?? 0);
              const conv = d ? Math.round((c / d) * 100) : 0;
              const name = `${String(r.agent__first_name ?? "")} ${String(r.agent__last_name ?? "")}`.trim() || String(r.agent__username ?? "—");
              return (
                <tr key={String(r.agent__id ?? i)}>
                  <td><span className="fc-priority-chip"><i style={{ background: i < 3 ? "#16a34a" : "#94a3b8" }} /><span>{i + 1}</span></span></td>
                  <td><strong style={{ fontSize: 12 }}>{name}</strong></td>
                  <td style={{ fontSize: 12 }}>{number.format(c)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.value)}</td>
                  <td><ProgressBar pct={conv} color="#0284c7" /></td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>—</td>
                  <td style={{ fontSize: 12, color: Number(r.cancelled ?? 0) > 0 ? "#b91c1c" : "#16a34a" }}>{number.format(Number(r.cancelled ?? 0))}</td>
                  <td><StatusPill value={d ? "active" : "inactive"} tone={d ? "green" : "gray"} /></td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
