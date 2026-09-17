"use client";

import { useMemo } from "react";
import {
  Button, Chip, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { Badge, KpiCard, KpiStrip, Panel, StatusPill, money } from "@/components/module-ui";
import { ListState, ViewToolbar } from "../PropertyToolbar";
import type { Row, ServiceChargeReconciliationRow } from "../../types/property.types";
import { kM, kN, fmtDate, shortId } from "../../utils/property.utils";
import { FileCheck, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export function ServiceChargeReconciliationsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onReview,
  onApprove,
  onDownloadPdf,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onReview?: (row: ServiceChargeReconciliationRow) => void;
  onApprove?: (row: ServiceChargeReconciliationRow) => void;
  onDownloadPdf?: (row: ServiceChargeReconciliationRow) => void;
}) {
  const reconciliations = rows as ServiceChargeReconciliationRow[];

  const filtered = useMemo(() => {
    return reconciliations.filter((r) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        String(r.service_charge_name ?? "").toLowerCase().includes(term) ||
        String(r.status ?? "").toLowerCase().includes(term) ||
        String(r.id ?? "").toLowerCase().includes(term)
      );
    });
  }, [reconciliations, search]);

  const totalBudgeted = filtered.reduce((sum, r) => sum + Number(r.budgeted_amount ?? 0), 0);
  const totalActual = filtered.reduce((sum, r) => sum + Number(r.actual_amount ?? 0), 0);
  const totalVariance = filtered.reduce((sum, r) => sum + Number(r.variance ?? 0), 0);
  const approvedCount = filtered.filter((r) => r.status === "approved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ViewToolbar
        title="Service Charge Reconciliations"
        subtitle="Audit prorated scheme budgets against actual incurred operating expenses"
        search={search}
        onSearch={setSearch}
        placeholder="Search by scheme name, period, or status…"
      />

      {/* Financial Audit Summary KPI Cards */}
      <KpiStrip cols={4}>
        <KpiCard
          icon={<FileCheck size={16} />}
          label="Reconciliation Statements"
          value={`${kN(filtered.length)} Periods`}
          sub={`${approvedCount} formally approved`}
          iconBg="rgba(37, 99, 235, 0.12)"
          iconColor="var(--color-info)"
          borderColor="var(--color-info)"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Prorated Budgeted OPEX"
          value={money.format(totalBudgeted)}
          sub="Target operational allowance"
          iconBg="rgba(217, 119, 6, 0.12)"
          iconColor="var(--color-warning)"
          borderColor="var(--color-warning)"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Actual Incurred Expenses"
          value={money.format(totalActual)}
          sub="Approved & paid OPEX bills"
          iconBg="rgba(14, 165, 233, 0.12)"
          iconColor="#0ea5e9"
          borderColor="#0ea5e9"
        />
        <KpiCard
          icon={totalVariance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          label="Net Variance"
          value={`${money.format(Math.abs(totalVariance))} ${totalVariance >= 0 ? "Surplus" : "Deficit"}`}
          sub={totalVariance >= 0 ? "✓ Under Budget (Tenant credit)" : "⚠ Over Budget (Balancing charge)"}
          iconBg={totalVariance >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(220, 38, 38, 0.12)"}
          iconColor={totalVariance >= 0 ? "var(--color-emerald)" : "var(--color-danger)"}
          borderColor={totalVariance >= 0 ? "var(--color-emerald)" : "var(--color-danger)"}
        />
      </KpiStrip>

      <Panel title="Period Reconciliations Register">
        <ListState
          loading={loading}
          empty={filtered.length === 0}
          emptyTitle="No reconciliations found"
          emptyDesc="Period reconciliations comparing budgeted to actual expenditure appear here. Click Reconcile on any Scheme to create one."
        >
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Reconciliation Ref</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Cost Centre Scheme</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Audit Period</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Budgeted OPEX</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actual Incurred</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Net Variance</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Prepared / Reviewed By</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => {
                  const varianceNum = Number(r.variance ?? 0);
                  const isSurplus = varianceNum >= 0;
                  const statusStr = String(r.status ?? "draft").toLowerCase();

                  return (
                    <TableRow key={String(r.id)} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 700 }}>
                          {shortId(r.id)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(r.service_charge_name ?? "—")}</Typography>
                        {r.property_name && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{String(r.property_name)}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {fmtDate(r.period_start)} — {fmtDate(r.period_end)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                          {money.format(Number(r.budgeted_amount ?? 0))}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 700 }}>
                          {money.format(Number(r.actual_amount ?? 0))}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 800,
                            color: isSurplus ? "success.main" : "error.main",
                          }}
                        >
                          {money.format(Math.abs(varianceNum))}
                          <Typography component="span" variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>
                            {isSurplus ? "(Surplus)" : "(Deficit)"}
                          </Typography>
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Prep: {String(r.prepared_by_name ?? "System")}
                        </Typography>
                        {Boolean(r.reviewed_by_name) && (
                          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700, display: "block" }}>
                            Rev: {String(r.reviewed_by_name)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <StatusPill value={statusStr} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {statusStr === "draft" && onReview && (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                              onClick={() => onReview(r)}
                            >
                              Review & Audit
                            </Button>
                          )}
                          {statusStr === "in_review" && onApprove && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                              onClick={() => onApprove(r)}
                            >
                              ✓ Approve
                            </Button>
                          )}
                          {statusStr === "approved" && onDownloadPdf && (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                              onClick={() => onDownloadPdf(r)}
                            >
                              📄 Download Cert
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </ListState>
      </Panel>
    </div>
  );
}
