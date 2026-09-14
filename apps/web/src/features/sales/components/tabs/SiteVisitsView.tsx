"use client";

import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { fmtDate, fmtDateTime } from "../../utils/sales.utils";
import { DataTable, RefText, TableChrome } from "../SalesUiComponents";

function visitStatus(row: Row): { label: string; tone: Tone } {
  if (row.converted_buyer) return { label: "Converted", tone: "green" };
  const followUp = row.follow_up_on ? new Date(String(row.follow_up_on)) : null;
  if (followUp && followUp.getTime() < Date.now()) return { label: "Follow-up due", tone: "red" };
  return { label: "Scheduled", tone: "blue" };
}

function isFollowUpDue(row: Row): boolean {
  return Boolean(!row.converted_buyer && row.follow_up_on && new Date(String(row.follow_up_on)).getTime() < Date.now());
}

export function SiteVisitsView({
  rows,
  search,
  setSearch,
  canVisit,
  openRecordVisit,
  onSendCommunication,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  canVisit: boolean;
  openRecordVisit: () => void;
  onSendCommunication?: (visit: Row) => void;
}) {
  const converted = rows.filter((r) => r.converted_buyer).length;
  const followDue = rows.filter(isFollowUpDue).length;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📍" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total Visits" value={number.format(rows.length)} sub="Clerk-recorded visits" />
        <KpiCard icon="✅" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Converted" value={number.format(converted)} sub="Became buyers" />
        <KpiCard icon="⏰" iconBg="var(--color-red-bg)" iconColor="var(--color-danger-strong)" label="Follow-up Due" value={number.format(followDue)} sub="Needs client follow-up" />
        <KpiCard icon="📅" iconBg="var(--color-sky-bg)" iconColor="var(--color-sky)" label="Scheduled" value={number.format(rows.length - converted - followDue)} sub="Upcoming presentations" />
      </KpiStrip>

      <Panel title="Site Visits & Presentations" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search visitor, phone or project…"
          actions={canVisit ? <button className="btn primary sm" onClick={openRecordVisit}>+ Record Visit (Clerk)</button> : null}
        >
          {rows.length === 0 ? (
            <EmptyState icon="📍" title="No site visits recorded" description="Sales clerks can log visitor arrivals, unit interests and introducing agents." action={canVisit ? <button className="btn primary sm" onClick={openRecordVisit}>+ Record Visit</button> : undefined} />
          ) : (
            <DataTable headers={["Visit Ref", "Visitor", "Contact", "Project", "Interest", "Agent", "Visit Date", "Follow-up", "Status", "Notes", "Actions"]}>
              {rows.map((r) => {
                const vs = visitStatus(r);
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.visitor_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{String(r.phone || r.email || "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.interested_unit_type || "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.agent_name || "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDateTime(r.visited_at)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.follow_up_on)}</td>
                    <td><StatusPill value={vs.label} tone={vs.tone} /></td>
                    <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 220 }}>{String(r.notes || "—")}</td>
                    <td>
                      {onSendCommunication && (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => onSendCommunication(r)}
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            backgroundColor: "#25D366",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                          }}
                          title="Send follow-up / reminder via WhatsApp"
                        >
                          <span>💬</span> Remind
                        </button>
                      )}
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
