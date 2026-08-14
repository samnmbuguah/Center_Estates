"use client";

import { Badge, EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDate } from "../../utils/sales.utils";
import { DataTable, TableChrome } from "../SalesUiComponents";

export function DocumentsView({
  rows,
  search,
  setSearch,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const finals = rows.filter((r) => r.is_final).length;

  return (
    <>
      <KpiStrip cols={3}>
        <KpiCard icon="📄" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Documents" value={number.format(rows.length)} sub="All legal records" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Final Versions" value={number.format(finals)} sub="Checksum-immutable" />
        <KpiCard icon="📝" iconBg="#fef3c7" iconColor="#92400e" label="Draft Versions" value={number.format(rows.length - finals)} sub="Awaiting finalisation" />
      </KpiStrip>

      <Panel title="Legal Documents" badge={rows.length}>
        <TableChrome search={search} setSearch={setSearch} placeholder="Search title, type or sale ref…">
          {rows.length === 0 ? (
            <EmptyState icon="📄" title="No legal documents" description="Advocate uploads (offer letters, agreements, KYC) will be listed here as immutable records." />
          ) : (
            <DataTable headers={["Document", "Sale Ref", "Type", "Signed On", "Checksum", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><strong style={{ fontSize: 12 }}>{String(r.title ?? "—")}</strong></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.sale_reference ?? "—")}</td>
                  <td><Badge tone="purple">{String(r.document_type ?? "—")}</Badge></td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.signed_on)}</td>
                  <td className="mono" style={{ fontSize: 10, color: "#6b7890" }}>{String(r.checksum ?? "—").slice(0, 12)}…</td>
                  <td><StatusPill value={r.is_final ? "Final" : "Draft"} tone={r.is_final ? "green" : "yellow"} /></td>
                  <td>
                    {r.file_url ? <a className="btn ghost sm" href={String(r.file_url)} target="_blank" rel="noreferrer">Download</a> : <span className="muted" style={{ fontSize: 12 }}>No file</span>}
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
