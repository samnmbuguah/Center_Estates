"use client";

import { money, number, EmptyState, KpiCard, KpiStrip, Panel, StatusPill } from "@/components/module-ui";
import { Dashboard, Row, SalesTab } from "../../types/sales.types";
import { fmtDate, fmtMoney } from "../../utils/sales.utils";
import { DataTable, RefText } from "../SalesUiComponents";
import { Box, Grid, Typography } from "@mui/material";
import { Building2, TrendingUp, CheckCircle, AlertTriangle, DollarSign, Calendar, Activity } from "lucide-react";

export function OverviewView({
  dashboard,
  setTab,
  openRegisterBuyer,
  openNewSale,
  openRecordVisit,
}: {
  dashboard: Dashboard;
  setTab: (t: SalesTab) => void;
  openRegisterBuyer: () => void;
  openNewSale: () => void;
  openRecordVisit: () => void;
}) {
  const kpis = dashboard.kpis ?? {};
  const available = Number(kpis.availableUnits ?? 0);
  const reserved = Number(kpis.reservedUnits ?? 0);
  const sold = Number(kpis.soldUnits ?? 0);
  const recentSales = dashboard.recentSales ?? [];
  const pendingPayments = dashboard.pendingPayments ?? [];
  const stage = dashboard.inventoryByStatus ?? [];
  const stageTotal = stage.reduce((s, r) => s + Number(r.count ?? 0), 0) || Math.max(available + reserved + sold, 1);
  const salesValue = Number(kpis.salesValue ?? 0);
  const verifiedPayments = Number(kpis.verifiedPayments ?? 0);
  const outstanding = salesValue - verifiedPayments;
  const collectionRate = salesValue > 0 ? Math.round((verifiedPayments / salesValue) * 100) : 0;
  const salesByProject = dashboard.salesByProject ?? [];

  const stageColors: Record<string, string> = {
    available: "#16a34a",
    reserved: "#f59e0b",
    sold: "#0284c7",
    pending: "#7c3aed",
    blocked: "#64748b",
  };
  const stageLabels: Record<string, string> = {
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    pending: "Pending",
    blocked: "Blocked",
  };

  type StageRow = Row & { pct: number; seg: string };
  const segs: StageRow[] = stage.map((s, i) => {
    const pct = (Number(s.count ?? 0) / stageTotal) * 100;
    const start = stage.slice(0, i).reduce((acc, x) => acc + (Number(x.count ?? 0) / stageTotal) * 100, 0);
    const seg = `${stageColors[String(s.status ?? "")] ?? "#94a3b8"} ${start.toFixed(2)}% ${(start + pct).toFixed(2)}%`;
    return { ...s, pct, seg } as StageRow;
  });
  const donutBg = segs.length
    ? `conic-gradient(${segs.map((s) => s.seg).join(", ")})`
    : "conic-gradient(#e5e7eb 0% 100%)";

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Sales Management Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
          Multi-project unit sales, buyer onboarding, payments, site visits & commissions.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#dcfce7", color: "#16a34a",
            textAlign: "center"
          }}>
            <Building2 size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(available)}</Typography>
            <Typography variant="caption">Available Units</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#dbeafe", color: "#2563eb",
            textAlign: "center"
          }}>
            <TrendingUp size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{fmtMoney(kpis.salesValue)}</Typography>
            <Typography variant="caption">Pipeline Value</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#e0f2fe", color: "#0284c7",
            textAlign: "center"
          }}>
            <CheckCircle size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(sold)}</Typography>
            <Typography variant="caption">Units Sold</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#ffedd5", color: "#ea580c",
            textAlign: "center"
          }}>
            <DollarSign size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{fmtMoney(kpis.pendingCommissions)}</Typography>
            <Typography variant="caption">Commissions Payable</Typography>
          </Box>
        </Grid>
      </Grid>

      <KpiStrip cols={4}>
        <KpiCard icon="💳" iconBg="#f0fdf4" iconColor="#15803d" label="Total Revenue" value={fmtMoney(kpis.verifiedPayments)} sub={`${number.format(Number(kpis.pendingPayments ?? 0))} awaiting verification`} link="View payments" onClick={() => setTab("payments")} />
        <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#b91c1c" label="Total Outstanding" value={fmtMoney(outstanding)} sub="Uncollected balance" onClick={() => setTab("payments")} />
        <KpiCard icon="📊" iconBg="#ede9fe" iconColor="#7c3aed" label="Collection Rate" value={`${collectionRate}%`} sub={`${fmtMoney(verifiedPayments)} of ${fmtMoney(salesValue)}`} onClick={() => setTab("payments")} />
        <KpiCard icon="🏗️" iconBg="#fef3c7" iconColor="#92400e" label="Units in Progress" value={number.format(reserved)} sub="Reserved units" link="View inventory" onClick={() => setTab("inventory")} />
      </KpiStrip>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <Panel title="Recent Sales" badge={recentSales.length} action={<button className="btn ghost sm" onClick={() => setTab("sales")}>View all →</button>}>
          {recentSales.length === 0 ? (
            <EmptyState icon="🧾" title="No recent sales" description="Newly registered sales will appear here with their buyer, unit and payment status." />
          ) : (
            <DataTable headers={["Sale Ref", "Buyer", "Project / Unit", "Price", "Paid", "Status", "Date"]}>
              {recentSales.map((s, i) => (
                <tr key={String(s.id ?? i)} onClick={() => setTab("sales")}>
                  <td><RefText value={s.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(s.buyer_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12, color: "#6b7890" }}>
                    {String(s.project_name ?? "—")}
                    {s.unit_code ? <div className="mono" style={{ fontSize: 10 }}>{String(s.unit_code)}</div> : null}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(s.agreed_price)}</td>
                  <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(s.paid_amount)}</td>
                  <td><StatusPill value={String(s.status ?? "")} /></td>
                  <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(s.contracted_on ?? s.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Panel title="Quick Actions">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                className="btn ghost" 
                onClick={openRegisterBuyer}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  textAlign: "left"
                }}
              >
                <span style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: 36, 
                  height: 36, 
                  borderRadius: "50%", 
                  background: "#ffedd5", 
                  color: "#ea580c",
                  fontSize: 18
                }}>👥</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Register Buyer</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Add new buyer to registry</div>
                </div>
              </button>
              
              <button 
                className="btn ghost" 
                onClick={openNewSale}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  textAlign: "left"
                }}
              >
                <span style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: 36, 
                  height: 36, 
                  borderRadius: "50%", 
                  background: "#dbeafe", 
                  color: "#2563eb",
                  fontSize: 18
                }}>📝</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>New Sale</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Create new sale agreement</div>
                </div>
              </button>
              
              <button 
                className="btn ghost" 
                onClick={openRecordVisit}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  textAlign: "left"
                }}
              >
                <span style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: 36, 
                  height: 36, 
                  borderRadius: "50%", 
                  background: "#dcfce7", 
                  color: "#16a34a",
                  fontSize: 18
                }}>📍</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Record Site Visit</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Log site visit (Clerk)</div>
                </div>
              </button>
              
              <button 
                className="btn ghost" 
                onClick={() => setTab("payments")}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  textAlign: "left"
                }}
              >
                <span style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: 36, 
                  height: 36, 
                  borderRadius: "50%", 
                  background: "#fef3c7", 
                  color: "#92400e",
                  fontSize: 18
                }}>💳</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Verify Payments</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Process pending payments</div>
                </div>
              </button>
            </div>
          </Panel>

          <Panel title="Stage Breakdown">
            <div style={{ alignItems: "center", display: "flex", gap: 16, padding: "14px 18px" }}>
              <div className="donut" style={{ background: donutBg, flexShrink: 0, height: 92, width: 92 }}>
                <strong style={{ fontSize: 16 }}>{number.format(stageTotal)}</strong>
                <small>Units</small>
              </div>
              <div className="donut-legend" style={{ flex: 1 }}>
                {segs.length === 0 && <span style={{ color: "#8a96a7", fontSize: 12 }}>No inventory staged yet.</span>}
                {segs.map((s) => (
                  <span key={String(s.status)}>
                    <i style={{ background: stageColors[String(s.status ?? "")] ?? "#94a3b8" }} />
                    {stageLabels[String(s.status ?? "")] ?? String(s.status ?? "—")}
                    <b>{number.format(Number(s.count ?? 0))}</b>
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          {pendingPayments.length > 0 && (
            <Panel title="Pending Verification" badge={pendingPayments.length} action={<button className="btn ghost sm" onClick={() => setTab("payments")}>Verify →</button>}>
              <div className="fc-alert-list">
                {pendingPayments.slice(0, 4).map((p, i) => (
                  <button key={String(p.id ?? i)} className="fc-alert-item" onClick={() => setTab("payments")}>
                    <span className="fc-alert-icon warning">⏳</span>
                    <div className="fc-alert-body">
                      <strong>{String(p.buyer_name ?? "—")}</strong>
                      <small className="mono">{String(p.reference ?? "—")}</small>
                      <em>{fmtMoney(p.amount)} · {String(p.method ?? "—")}</em>
                    </div>
                    <span className="fc-alert-chevron">›</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {salesByProject.length > 0 && (
            <Panel title="Sales by Project" badge={salesByProject.length}>
              <div style={{ padding: 14 }}>
                {salesByProject.map((r) => {
                  const name = String(r["listing__project__name"] ?? "Unknown");
                  const count = Number(r.count ?? 0);
                  const maxCount = Math.max(...salesByProject.map((x) => Number(x.count ?? 0)), 1);
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={name} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span className="mono" style={{ fontWeight: 700, color: "#ea580c" }}>{number.format(count)} sales</span>
                      </div>
                      <div style={{ background: "#edf0f5", borderRadius: 4, height: 18, overflow: "hidden" }}>
                        <div style={{ background: "linear-gradient(90deg, #ea580c, #f59e0b)", height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.3s ease", minWidth: count > 0 ? 4 : 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <div className="summary-strip">
        <span><b>{number.format(available)}</b> Available units</span>
        <span><b>{number.format(reserved)}</b> Reserved units</span>
        <span><b>{number.format(sold)}</b> Sold units</span>
        <span><b>{number.format(Number(kpis.activeBuyers ?? 0))}</b> Active buyers</span>
        <span><b>{number.format(Number(kpis.siteVisits ?? 0))}</b> Site visits recorded</span>
      </div>
    </>
  );
}
