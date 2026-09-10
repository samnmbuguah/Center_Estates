"use client";

import { EmptyState, Panel } from "@/components/module-ui";
import { Row } from "../../types/sales.types";
import { fmtDate } from "../../utils/sales.utils";
import { RefText } from "../SalesUiComponents";

export function SalesClerkView({
  rows,
  canVisit,
  canSell,
  openRecordVisit,
  openRegisterBuyer,
  openNewSale,
}: {
  rows: Row[];
  canVisit: boolean;
  canSell: boolean;
  openRecordVisit: () => void;
  openRegisterBuyer: () => void;
  openNewSale: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysVisits = rows.filter((r) => String(r.visited_at ?? "").slice(0, 10) === today);
  const upcoming = rows
    .filter((r) => r.follow_up_on && String(r.follow_up_on) >= today)
    .sort((a, b) => String(a.follow_up_on).localeCompare(String(b.follow_up_on)))
    .slice(0, 6);

  const actions = [
    { key: "visit", label: "Record Site Visit", detail: "Log a prospect visit & agent", icon: "📍", bg: "var(--color-green-bg)", fg: "var(--color-success-strong)", onClick: openRecordVisit, enabled: canVisit },
    { key: "buyer", label: "Register Buyer", detail: "Capture buyer details & KYC", icon: "👥", bg: "var(--color-blue-bg)", fg: "var(--color-info-strong)", onClick: openRegisterBuyer, enabled: canSell },
    { key: "sale", label: "Reserve / New Sale", detail: "Attach a buyer to a unit", icon: "🤝", bg: "var(--color-orange-soft)", fg: "#c2410c", onClick: openNewSale, enabled: canSell },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="data-panel" style={{ padding: 18, borderLeft: "3px solid var(--color-orange)" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Field capture</h3>
        <p style={{ margin: "4px 0 14px", fontSize: 12, color: "var(--muted)" }}>
          Built for phones and tablets at the site — capture visits, buyers and reservations in seconds.
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={!a.enabled}
              onClick={a.onClick}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                padding: 16, minHeight: 108, borderRadius: 14, cursor: a.enabled ? "pointer" : "not-allowed",
                border: "1px solid var(--border)", background: a.enabled ? "var(--surface)" : "var(--surface-sunken, var(--surface-sunken))",
                opacity: a.enabled ? 1 : 0.6, textAlign: "left",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", background: a.bg, color: a.fg, fontSize: 20 }}>{a.icon}</span>
              <strong style={{ fontSize: 14 }}>{a.label}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid-2" style={{ gap: 16, alignItems: "start" }}>
        <Panel title="Today's visits" badge={todaysVisits.length}>
          {todaysVisits.length === 0 ? (
            <EmptyState icon="📍" title="No visits logged today" description="Record a site visit as prospects arrive." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todaysVisits.map((v, i) => <VisitCard key={String(v.id ?? i)} visit={v} />)}
            </div>
          )}
        </Panel>

        <Panel title="Follow-ups due" badge={upcoming.length}>
          {upcoming.length === 0 ? (
            <EmptyState icon="📅" title="No follow-ups scheduled" description="Scheduled follow-ups will appear here." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map((v, i) => <VisitCard key={String(v.id ?? i)} visit={v} showFollowUp />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function VisitCard({ visit, showFollowUp = false }: { visit: Row; showFollowUp?: boolean }) {
  return (
    <article style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--color-success)", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13 }}>{String(visit.visitor_name ?? "Visitor")}</strong>
        <RefText value={visit.reference} />
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
        {String(visit.project_name ?? "—")}
        {visit.interested_unit_type ? ` · ${String(visit.interested_unit_type)}` : ""}
        {visit.agent_name ? ` · ${String(visit.agent_name)}` : ""}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
        {showFollowUp ? `Follow up ${fmtDate(visit.follow_up_on)}` : `Visited ${fmtDate(visit.visited_at)}`}
        {visit.phone ? ` · ${String(visit.phone)}` : ""}
      </div>
    </article>
  );
}
