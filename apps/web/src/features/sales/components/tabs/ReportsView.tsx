"use client";

import { EmptyState, Panel } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDateTime } from "../../utils/sales.utils";
import { DataTable } from "../SalesUiComponents";

export function ReportsView({
  rows,
  recentExports,
  exportReport,
}: {
  rows: Row[];
  recentExports: Row[];
  exportReport: (key: string, name: string) => void;
}) {
  const icons: Record<string, string> = {
    inventory: "🏠",
    sales: "📋",
    payments: "💳",
    commissions: "🧾",
    visits: "📍",
  };
  const descriptions: Record<string, string> = {
    inventory: "Unit availability, pricing and construction progress by project.",
    sales: "Sales pipeline with buyers, units, agents and sale status.",
    payments: "Reconciled payment ledger for online and offline channels.",
    commissions: "Agent commission ledger with payment and construction gates.",
    visits: "Site visit register with attribution to introducing agents.",
  };

  return (
    <>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", marginBottom: 18 }}>
        {rows.length === 0 ? (
          <EmptyState icon="📊" title="No report catalogue" description="The analytics service will provide report definitions here." />
        ) : (
          rows.map((r) => {
            const key = String(r.key ?? "");
            const name = String(r.name ?? "Report");
            return (
              <article className="data-panel" key={key} style={{ padding: 18 }}>
                <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 10 }}>
                  <span className="fc-asset-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>{icons[key] ?? "📄"}</span>
                  <strong style={{ fontSize: 13 }}>{name}</strong>
                </div>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 14px", minHeight: 36 }}>{descriptions[key] ?? "Exports the current sales dataset as CSV."}</p>
                <button className="btn primary sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => exportReport(key, name)}>↓ Export CSV</button>
              </article>
            );
          })
        )}
      </div>

      <Panel title="Recent Exports" badge={recentExports.length}>
        {recentExports.length === 0 ? (
          <EmptyState icon="🕘" title="No exports yet" description="Reports you download from the catalogue will be tracked here." />
        ) : (
          <DataTable headers={["Report", "File", "Exported At"]}>
            {recentExports.map((e, i) => (
              <tr key={`${String(e.key)}-${i}`}>
                <td><strong style={{ fontSize: 12 }}>{String(e.name ?? "—")}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>sales-{String(e.key)}.csv</td>
                <td style={{ fontSize: 12 }}>{fmtDateTime(e.exportedAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
