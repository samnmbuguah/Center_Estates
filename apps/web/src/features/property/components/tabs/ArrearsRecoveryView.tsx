"use client";

import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Panel, EmptyState, Badge, KpiStrip, KpiCard, money } from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import { PropertyTab, Row, AgingTenantRow, AgingAnalytics, ReminderRow } from "../../types/property.types";
import { kM, kN, fmtDate, pct } from "../../utils/property.utils";

type SubTab = "aging" | "reminders";

export function ArrearsRecoveryView({
  rows, reminders = [], analytics, loading, search, setSearch, setTab, onSendReminder,
}: {
  rows: Row[]; reminders?: Row[]; analytics: AgingAnalytics | null;
  loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onSendReminder?: (r: ReminderRow) => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("aging");
  const tenants = rows as AgingTenantRow[];
  const reminderList = reminders as ReminderRow[];
  const summary = analytics?.summary ?? {};
  const total = Number(analytics?.total ?? Object.values(summary).reduce((s, v) => s + Number(v ?? 0), 0));
  const totalOutstanding = tenants.reduce((s, t) => s + Number(t.outstanding ?? 0), 0);
  const oldestDays = tenants.length > 0 ? Math.max(...tenants.map(t => Number(t.oldest_days ?? 0))) : 0;

  const buckets = [
    { label: "0-30 days", key: "current" },
    { label: "31-60 days", key: "31_60" },
    { label: "61-90 days", key: "61_90" },
    { label: "90+ days", key: "over_120" },
  ];

  return (
    <>
      <SubTabs
        tabs={[{ id: "aging", label: "Aging Overview" }, { id: "reminders", label: `Reminder History (${reminderList.length})` }]}
        active={subTab}
        onChange={(id) => setSubTab(id as SubTab)}
      />

      {subTab === "aging" && (
        <>
          <KpiStrip>
            <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Total Outstanding" value={kM(totalOutstanding)} sub={`${tenants.length} tenant(s)`} />
            <KpiCard icon="📅" iconBg="#fef3c7" iconColor="#d97706" label="Oldest Debt" value={`${kN(oldestDays)} days`} sub="Days overdue" />
            <KpiCard icon="🔔" iconBg="#e0e7ff" iconColor="#4f46e5" label="Reminders Sent" value={kN(reminderList.length)} sub="This period" />
          </KpiStrip>

          <Panel title="Aging Buckets">
            {total > 0 ? (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead><tr><th>Bucket</th><th>Amount</th><th>% of total</th><th>Bar</th></tr></thead>
                  <tbody>
                    {buckets.map((b) => {
                      const amount = Number(summary[b.key] ?? 0) + (b.key === "over_120" ? Number(summary["91_120"] ?? 0) : 0);
                      return (
                        <tr key={b.key}>
                          <td style={{ fontSize: 12 }}>{b.label}</td>
                          <td className="mono" style={{ color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</td>
                          <td className="mono" style={{ fontSize: 11, width: 50 }}>{pct(amount, total)}%</td>
                          <td>
                            <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden", minWidth: 120 }}>
                              <div style={{ width: `${pct(amount, total)}%`, height: "100%", background: amount > 0 ? "#e23b3b" : "var(--border-strong)", transition: "width 0.3s" }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                      <td className="mono" style={{ color: "var(--danger)" }}><strong>{kM(total)}</strong></td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="✓" title="No arrears" description="All invoices have been collected." />
            )}
          </Panel>

          <Panel title="Tenants in Arrears">
            <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants in arrears" emptyDesc="Tenants with unpaid invoices will appear here.">
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead><tr><th>Tenant</th><th>Property</th><th>Outstanding</th><th>Days Overdue</th><th>Actions</th></tr></thead>
                  <tbody>
                    {tenants.map((t, i) => (
                      <tr key={i}>
                        <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                        <td style={{ fontSize: 12 }}>{String(t.property ?? "—")}</td>
                        <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                        <td><Badge tone={Number(t.oldest_days ?? 0) > 90 ? "red" : Number(t.oldest_days ?? 0) > 60 ? "yellow" : "blue"}>{kN(t.oldest_days)}d</Badge></td>
                        <td>
                          <button className="btn primary sm" onClick={() => onSendReminder?.({ id: "", tenant_name: String(t.tenant ?? ""), invoice_number: "", channel: "email", recipient: "", sent_at: "", message: "" } as ReminderRow)}>Send Reminder</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ListState>
          </Panel>
        </>
      )}

      {subTab === "reminders" && (
        <Panel title="Payment Reminders">
          <ListState loading={loading} empty={reminderList.length === 0} emptyTitle="No reminders sent" emptyDesc="Payment reminders sent from the arrears workflow appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead><tr><th>Tenant</th><th>Invoice</th><th>Channel</th><th>Recipient</th><th>Sent</th><th>Status</th></tr></thead>
                <tbody>
                  {reminderList.map((r) => (
                    <tr key={String(r.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.channel ?? "—").replace(/_/g, " ")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.recipient ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                      <td><Badge tone="green">Sent</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}
    </>
  );
}
