"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Download } from "lucide-react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.5, borderRadius: 2, flex: 1, minWidth: 160 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            background: iconBg, color: iconColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 900 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

export function FMBudgetView({
  rows,
  organizationId,
}: {
  rows: Row[];
  organizationId: string | null;
}) {
  const [selectedYear, setSelectedYear] = useState("2026");

  const budgetCategories = rows;

  const fld = (b: Record<string, unknown>, base: string) => Number(b[`${base}_amount`] ?? b[base] ?? 0);
  const totalAllocated = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "allocated"), 0);
  const totalCommitted = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "committed"), 0);
  const totalActual = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "actual"), 0);
  const totalSpentAndCommitted = totalActual + totalCommitted;
  const availableReserve = Math.max(0, totalAllocated - totalSpentAndCommitted);
  const utilizationPct = totalAllocated ? ((totalSpentAndCommitted / totalAllocated) * 100).toFixed(1) : "0.0";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Top Budget KPIs */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <FcKpiCard icon="💰" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Annual FM Budget" value={money.format(totalAllocated)} sub={`Financial Year ${selectedYear}`} />
        <FcKpiCard icon="💳" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Invoiced Actual Spend" value={money.format(totalActual)} sub="Approved invoices paid" />
        <FcKpiCard icon="🔒" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-deep)" label="Committed Spend (POs)" value={money.format(totalCommitted)} sub="Reserved on open work orders" />
        <FcKpiCard icon="📊" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="Budget Utilization" value={`${utilizationPct}%`} sub={totalAllocated ? "Actual plus committed spend" : "No approved budget yet"} />
        <FcKpiCard icon="🛡️" iconBg="#fdf4ff" iconColor="var(--color-purple)" label="Available Reserve" value={money.format(availableReserve)} sub="Remaining uncommitted float" />
      </Box>

      {/* Main Budget & Commitment Control Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            px: 2.5, py: 2,
            borderBottom: "1px solid", borderColor: "divider",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Facility Cost Center Budgeting & Commitment Control
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tracks PO reserves prior to invoice matching to prevent budget overruns (Cost / m²: KES 501 / m²)
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={14} />}
            onClick={() => exportCsv(budgetCategories, "budget-variance.csv")}
            sx={{ fontWeight: 700 }}
          >
            Export Budget Variance
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Service Cost Category</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Allocated Budget</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Committed (Open POs)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoiced Actuals</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Total Encumbered</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Remaining Variance</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Utilization %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgetCategories.map((b) => {
                const brow = b as Record<string, unknown>;
                const encumbered = fld(brow, "actual") + fld(brow, "committed");
                const remaining = fld(brow, "allocated") - encumbered;
                const allocatedNum = fld(brow, "allocated");
                const pct = allocatedNum ? Math.round((encumbered / allocatedNum) * 100) : 0;
                return (
                  <TableRow key={String(b.id)} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{String(b.category)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{money.format(fld(b as Record<string, unknown>, "allocated"))}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="warning.main">{money.format(fld(b as Record<string, unknown>, "committed"))}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="info.main">{money.format(fld(b as Record<string, unknown>, "actual"))}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{money.format(encumbered)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 800 }} color={remaining >= 0 ? "success.main" : "error"}>
                        {money.format(remaining)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${pct}%`}
                        size="small"
                        color={pct <= 85 ? "success" : pct <= 95 ? "warning" : "error"}
                        sx={{ fontWeight: 800, fontSize: 11 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {budgetCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No budget categories configured for this property.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
