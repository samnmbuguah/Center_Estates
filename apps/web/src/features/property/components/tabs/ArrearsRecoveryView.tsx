"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Panel, EmptyState, Badge, KpiStrip, KpiCard } from "@/components/module-ui";
import { ListState, SubTabs } from "../PropertyToolbar";
import { PropertyTab, Row, AgingTenantRow, AgingAnalytics, ReminderRow } from "../../types/property.types";
import { kM, kN, fmtDate, pct } from "../../utils/property.utils";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type SubTab = "aging" | "exposure" | "reminders";
type ExposureRow = {
  tenant_id: string; tenant: string; unit: string; property: string; lease_reference: string;
  deposit_required: string; deposit_billed: string; deposit_paid: string; arrears: string;
  net_exposure: string; oldest_days: number; oldest_invoice_id?: string; oldest_invoice_number?: string;
  recommended_action: "none" | "payment_reminder" | "formal_demand" | "notice_to_vacate";
};

export function ArrearsRecoveryView({
  rows, reminders = [], analytics, loading, search, setSearch, setTab, onSendReminder,
}: {
  rows: Row[]; reminders?: Row[]; analytics: AgingAnalytics | null;
  loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onSendReminder?: (r: ReminderRow) => void;
}) {
  const { session } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("aging");
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [exposureLoading, setExposureLoading] = useState(false);
  const [exposureError, setExposureError] = useState("");
  const [notice, setNotice] = useState("");
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

  useEffect(() => {
    if (subTab !== "exposure" || !session?.activeOrganizationId) return;
    let active = true;
    setExposureLoading(true); setExposureError("");
    apiFetch("/property/tenants/deposit-arrears-exposure/", {}, session.activeOrganizationId)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Exposure could not be loaded."));
        const payload = await response.json(); if (active) setExposure(payload.results ?? []);
      })
      .catch((reason) => { if (active) setExposureError(reason instanceof Error ? reason.message : "Exposure could not be loaded."); })
      .finally(() => { if (active) setExposureLoading(false); });
    return () => { active = false; };
  }, [subTab, session?.activeOrganizationId]);

  async function sendRecoveryNotice(row: ExposureRow) {
    if (!row.oldest_invoice_id || !session?.activeOrganizationId) return;
    const action = row.recommended_action.replaceAll("_", " ");
    if (!window.confirm(`Send ${action} to ${row.tenant} through the tenant portal?`)) return;
    setNotice(""); setExposureError("");
    const message = row.recommended_action === "notice_to_vacate"
      ? `Notice to remedy arrears: KES ${Number(row.arrears).toLocaleString()} remains outstanding for ${row.unit}. Please settle or contact management immediately. This notice does not terminate the lease without the required approval and legal process.`
      : row.recommended_action === "formal_demand"
        ? `Formal payment demand: KES ${Number(row.arrears).toLocaleString()} remains outstanding for ${row.unit}. Please settle the balance or contact management to agree a recovery plan.`
        : `Payment reminder: KES ${Number(row.arrears).toLocaleString()} remains outstanding for ${row.unit}. Please review your invoices in the tenant portal.`;
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/property/invoices/${row.oldest_invoice_id}/send-reminder/`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ channel: "portal", notice_type: row.recommended_action, message }),
    }, session.activeOrganizationId);
    if (!response.ok) { setExposureError(await apiErrorMessage(response, "Notice could not be sent.")); return; }
    setNotice(`${action.charAt(0).toUpperCase()}${action.slice(1)} sent to ${row.tenant}.`);
  }

  return (
    <>
      <SubTabs
        tabs={[{ id: "aging", label: "Aging Overview" }, { id: "exposure", label: "Deposit & arrears exposure" }, { id: "reminders", label: `Notice history (${reminderList.length})` }]}
        active={subTab}
        onChange={(id) => setSubTab(id as SubTab)}
      />

      {subTab === "aging" && (
        <>
          <KpiStrip>
            <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="#dc2626" label="Total Outstanding" value={kM(totalOutstanding)} sub={`${tenants.length} tenant(s)`} />
            <KpiCard icon="📅" iconBg="rgba(217,119,6,0.12)" iconColor="#d97706" label="Oldest Debt" value={`${kN(oldestDays)} days`} sub="Days overdue" />
            <KpiCard icon="🔔" iconBg="rgba(79,70,229,0.12)" iconColor="#4f46e5" label="Reminders Sent" value={kN(reminderList.length)} sub="This period" />
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
                          <button className="btn primary sm" onClick={() => setTab("rent")}>Remind via Invoices</button>
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

      {subTab === "exposure" && <Panel title="Deposit cover & recovery actions">
        <Typography color="text.secondary" sx={{ mb: 2, fontSize: 13 }}>
          Deposit obligations come from the unit billing schedule. Paid deposits are shown separately from arrears and never posted as rent income.
        </Typography>
        {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
        {exposureError && <Alert severity="error" sx={{ mb: 2 }}>{exposureError}</Alert>}
        <ListState loading={exposureLoading} empty={exposure.length === 0} emptyTitle="No current lease exposure" emptyDesc="Current leases will appear here with deposit cover and arrears.">
          <div className="table-scroll"><table className="fc-data-table"><thead><tr><th>Tenant / unit</th><th>Deposit required</th><th>Deposit paid</th><th>Arrears</th><th>Net exposure</th><th>Age</th><th>Recommended next step</th></tr></thead>
            <tbody>{exposure.map((row) => <tr key={row.lease_reference}>
              <td><strong>{row.tenant}</strong><br/><span className="muted">{row.unit} · {row.lease_reference}</span></td>
              <td className="mono">{kM(row.deposit_required)}</td><td className="mono">{kM(row.deposit_paid)}</td>
              <td className="mono" style={{ color: Number(row.arrears) > 0 ? "var(--danger)" : undefined }}>{kM(row.arrears)}</td>
              <td className="mono"><strong>{kM(row.net_exposure)}</strong></td><td>{row.oldest_days}d</td>
              <td>{row.recommended_action === "none" ? <Badge tone="green">Clear</Badge> : <Button size="small" variant="outlined" color={row.recommended_action === "notice_to_vacate" ? "error" : "primary"} onClick={() => sendRecoveryNotice(row)}>{row.recommended_action.replaceAll("_", " ")}</Button>}</td>
            </tr>)}</tbody></table></div>
        </ListState>
      </Panel>}

      {subTab === "reminders" && (
        <Panel title="Payment Reminders">
          <ListState loading={loading} empty={reminderList.length === 0} emptyTitle="No reminders sent" emptyDesc="Payment reminders sent from the arrears workflow appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead><tr><th>Tenant</th><th>Invoice</th><th>Notice type</th><th>Channel</th><th>Recipient</th><th>Sent</th><th>Status</th></tr></thead>
                <tbody>
                  {reminderList.map((r) => (
                    <tr key={String(r.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.notice_type ?? "payment reminder").replace(/_/g, " ")}</td>
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
