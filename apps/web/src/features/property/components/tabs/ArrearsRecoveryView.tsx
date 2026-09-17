"use client";

import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography,
} from "@mui/material";
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
            <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="var(--color-danger)" label="Total Outstanding" value={kM(totalOutstanding)} sub={`${tenants.length} tenant(s)`} />
            <KpiCard icon="📅" iconBg="rgba(217,119,6,0.12)" iconColor="var(--color-warning)" label="Oldest Debt" value={`${kN(oldestDays)} days`} sub="Days overdue" />
            <KpiCard icon="🔔" iconBg="rgba(79,70,229,0.12)" iconColor="var(--color-indigo)" label="Reminders Sent" value={kN(reminderList.length)} sub="This period" />
          </KpiStrip>

          <Panel title="Aging Buckets">
            {total > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Bucket</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>% of total</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Bar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {buckets.map((b) => {
                      const amount = Number(summary[b.key] ?? 0) + (b.key === "over_120" ? Number(summary["91_120"] ?? 0) : 0);
                      return (
                        <TableRow key={b.key} hover>
                          <TableCell><Typography variant="body2">{b.label}</Typography></TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: amount > 0 ? "error.main" : "text.secondary" }}>
                              {kM(amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                              {pct(amount, total)}%
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ width: "100%", maxWidth: 200, height: 6, borderRadius: 99, bgcolor: "action.selected", overflow: "hidden" }}>
                              <Box sx={{ width: `${pct(amount, total)}%`, height: "100%", bgcolor: amount > 0 ? "error.main" : "text.disabled", transition: "width 0.3s" }} />
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ bgcolor: "action.selected" }}>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main", fontWeight: 800 }}>{kM(total)}</Typography></TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState icon="✓" title="No arrears" description="All invoices have been collected." />
            )}
          </Panel>

          <Panel title="Tenants in Arrears">
            <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants in arrears" emptyDesc="Tenants with unpaid invoices will appear here.">
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Outstanding</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Days Overdue</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tenants.map((t, i) => (
                      <TableRow key={i} hover>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(t.tenant ?? "—")}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{String(t.property ?? "—")}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main", fontWeight: 700 }}>
                            {kM(t.outstanding)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center"><Badge tone={Number(t.oldest_days ?? 0) > 90 ? "red" : Number(t.oldest_days ?? 0) > 60 ? "yellow" : "blue"}>{kN(t.oldest_days)}d</Badge></TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="contained" color="primary" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => setTab("rent")}>
                            Remind via Invoices
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant / Unit</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Deposit Required</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Deposit Paid</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Arrears</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Net Exposure</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Age</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Recommended Next Step</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exposure.map((row) => (
                  <TableRow key={row.lease_reference} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.tenant}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.unit} · {row.lease_reference}</Typography>
                    </TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(row.deposit_required)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(row.deposit_paid)}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: Number(row.arrears) > 0 ? "error.main" : "inherit" }}>
                        {kM(row.arrears)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>
                        {kM(row.net_exposure)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><Typography variant="body2">{row.oldest_days}d</Typography></TableCell>
                    <TableCell align="center">
                      {row.recommended_action === "none" ? (
                        <Badge tone="green">Clear</Badge>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color={row.recommended_action === "notice_to_vacate" ? "error" : "primary"}
                          onClick={() => sendRecoveryNotice(row)}
                          sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                        >
                          {row.recommended_action.replaceAll("_", " ")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ListState>
      </Panel>}

      {subTab === "reminders" && (
        <Panel title="Payment Reminders">
          <ListState loading={loading} empty={reminderList.length === 0} emptyTitle="No reminders sent" emptyDesc="Payment reminders sent from the arrears workflow appear here.">
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoice</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Notice Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Sent</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reminderList.map((r) => (
                    <TableRow key={String(r.id)} hover>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(r.tenant_name ?? "—")}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                          {String(r.invoice_number ?? "—")}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{String(r.notice_type ?? "payment reminder").replace(/_/g, " ")}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{String(r.channel ?? "—").replace(/_/g, " ")}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{String(r.recipient ?? "—")}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{fmtDate(r.sent_at)}</Typography></TableCell>
                      <TableCell align="center"><Badge tone="green">Sent</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </ListState>
        </Panel>
      )}
    </>
  );
}
