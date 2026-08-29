"use client";

import { Box, Paper, Typography } from "@mui/material";
import { money } from "@/components/module-ui";

export function BillingKpis({ totals, ready, issues, generatedCount, generatedAmount }: {
  totals: Record<string, string | number>; ready: number; issues: number;
  generatedCount: number; generatedAmount: number;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.25 }}>
      {[
        { label: "Target Revenue", value: money.format(Number(totals.total_amount ?? 0)), sub: `${totals.candidates ?? 0} units`, icon: "🎯", color: "#3b82f6" },
        { label: "Ready to Bill", value: money.format(Number(totals.amount_ready ?? 0)), sub: `${ready} verified`, icon: "✨", color: "#22c55e" },
        { label: "Exceptions", value: money.format(Number(totals.amount_with_issues ?? 0)), sub: `${issues} need action`, icon: "⚠️", color: issues > 0 ? "#ef4444" : "#94a3b8" },
        { label: "Generated", value: money.format(generatedAmount), sub: `${generatedCount} issued`, icon: "📄", color: "#6366f1" },
      ].map((kpi, i) => (
        <Paper key={i} variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, borderLeft: "3px solid", borderLeftColor: kpi.color }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 10 }}>{kpi.label}</Typography>
            <span style={{ fontSize: 13 }}>{kpi.icon}</span>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, my: 0.25, fontSize: 15 }}>{kpi.value}</Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 10.5 }}>{kpi.sub}</Typography>
        </Paper>
      ))}
    </Box>
  );
}
