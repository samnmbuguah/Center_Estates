"use client";

import { Badge, EmptyState, KpiCard, KpiStrip, number, Panel } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDateTime, toneForAudit } from "../../utils/sales.utils";
import { DataTable, TableChrome } from "../SalesUiComponents";

export function AuditEventsView({
  rows,
  search,
  setSearch,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const paymentEvents = rows.filter((r) => String(r.event_type).includes("payment")).length;
  const statusChanges = rows.filter((r) => String(r.event_type).includes("status")).length;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🕘" iconBg="#e0e7ff" iconColor="#4f46e5" label="Audit Events" value={number.format(rows.length)} sub="Immutable activity log" />
        <KpiCard icon="💳" iconBg="#fef3c7" iconColor="#92400e" label="Payment Events" value={number.format(paymentEvents)} sub="Submissions & verification" />
        <KpiCard icon="🔀" iconBg="#e0f2fe" iconColor="#0284c7" label="Status Changes" value={number.format(statusChanges)} sub="Sale & commission moves" />
        <KpiCard icon="🧾" iconBg="#dcfce7" iconColor="#16a34a" label="Verified" value={number.format(rows.filter((r) => String(r.event_type).includes("verified")).length)} sub="Payments approved" />
      </KpiStrip>

      <Panel title="Audit Trail" badge={rows.length}>
        <TableChrome search={search} setSearch={setSearch} placeholder="Search event, sale ref, notes…">
          {rows.length === 0 ? (
            <EmptyState icon="🕘" title="No audit events" description="Every financial and workflow decision will be recorded here with the acting user." />
          ) : (
            <DataTable headers={["Timestamp", "User", "Action", "Entity", "Detail"]}>
              {rows.map((r) => {
                const entity = String(r.sale_reference || r.payment_reference || "—");
                const detail = typeof r.notes === "string" && r.notes ? String(r.notes) : JSON.stringify(r.details ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDateTime(r.created_at)}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.actor_name ?? "—")}</strong></td>
                    <td><Badge tone={toneForAudit(String(r.event_type))}>{String(r.event_type ?? "—").replaceAll("_", " ")}</Badge></td>
                    <td className="mono" style={{ fontSize: 12 }}>{entity}</td>
                    <td style={{ fontSize: 11, color: "#6b7890", maxWidth: 320 }}>{detail}</td>
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
