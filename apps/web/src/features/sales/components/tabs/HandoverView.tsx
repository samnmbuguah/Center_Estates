"use client";

import { useState } from "react";
import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDate } from "../../utils/sales.utils";
import { DataTable, RefText, TableChrome } from "../SalesUiComponents";

export function HandoverView({
  rows,
  search,
  setSearch,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const [handoverStatus, setHandoverStatus] = useState<Record<string, string>>({});

  const totalUnits = rows.length;
  const readyCount = rows.filter((r) => handoverStatus[String(r.id)] === "ready").length;
  const handedOverCount = rows.filter((r) => handoverStatus[String(r.id)] === "handed_over").length;
  const pendingCount = totalUnits - readyCount - handedOverCount;

  function markReady(id: string) {
    setHandoverStatus((prev) => ({ ...prev, [id]: "ready" }));
  }

  function completeHandover(id: string) {
    setHandoverStatus((prev) => ({ ...prev, [id]: "handed_over" }));
  }

  function exportCsv() {
    const header = "Unit Code,Project,Buyer,Sale Date,Inspection,Handover Date,Status\n";
    const body = rows.map((r) => {
      const st = handoverStatus[String(r.id)] ?? "pending";
      return [
        String(r.unit_code ?? ""),
        String(r.project_name ?? ""),
        String(r.buyer_name ?? ""),
        String(r.contracted_on ?? ""),
        st === "handed_over" ? "Passed" : st === "ready" ? "Scheduled" : "Pending",
        st === "handed_over" ? new Date().toLocaleDateString("en-GB") : "",
        st,
      ].join(",");
    }).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handover-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏠" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Units" value={number.format(totalUnits)} sub="Completed sales eligible" />
        <KpiCard icon="📦" iconBg="#dcfce7" iconColor="#16a34a" label="Ready for Handover" value={number.format(readyCount)} sub="Awaiting handover completion" />
        <KpiCard icon="✅" iconBg="#e0f2fe" iconColor="#0284c7" label="Handed Over" value={number.format(handedOverCount)} sub="Units fully delivered" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending Inspection" value={number.format(pendingCount)} sub="Not yet ready" />
      </KpiStrip>

      <Panel title="Unit Handover" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search unit code, buyer, project…"
          actions={<button className="btn primary sm" onClick={exportCsv}>↓ Export Handover Report</button>}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🏠" title="No units ready for handover" description="Completed sales that are candidates for handover will appear here." />
          ) : (
            <DataTable headers={["Unit Code", "Property", "Buyer", "Sale Date", "Inspection", "Handover Date", "Status", "Actions"]}>
              {rows.map((r) => {
                const st = handoverStatus[String(r.id)] ?? "pending";
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.unit_code} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(r.contracted_on ?? r.created_at)}</td>
                    <td><StatusPill value={st === "handed_over" ? "Passed" : st === "ready" ? "Scheduled" : "Pending"} /></td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{st === "handed_over" ? fmtDate(new Date().toISOString()) : "—"}</td>
                    <td><StatusPill value={st === "handed_over" ? "completed" : st === "ready" ? "ready" : "pending"} /></td>
                    <td>
                      {st === "pending" && <button className="btn ghost sm" onClick={() => markReady(String(r.id))}>Mark Ready for Handover</button>}
                      {st === "ready" && <button className="btn primary sm" onClick={() => completeHandover(String(r.id))}>Complete Handover</button>}
                      {st === "handed_over" && <span style={{ fontSize: 11, color: "#16a34a" }}>✓ Done</span>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}
