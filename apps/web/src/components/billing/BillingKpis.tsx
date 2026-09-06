"use client";

import { Box, Paper, Typography } from "@mui/material";
import { AlertTriangle, CircleCheckBig, ReceiptText } from "lucide-react";
import { money } from "@/components/module-ui";

export function BillingKpis({ totals, ready, issues, generatedCount, generatedAmount }: {
  totals: Record<string, string | number>; ready: number; issues: number;
  generatedCount: number; generatedAmount: number;
}) {
  const targetAmount = Number(totals.total_amount ?? 0);
  const readyAmount = Number(totals.amount_ready ?? 0);
  const issueAmount = Number(totals.amount_with_issues ?? 0);
  const candidateCount = Number(totals.candidates ?? totals.total_candidates ?? 0);

  return (
    <>
      <Box className="billing-kpi-grid">
        <Paper className="billing-kpi billing-kpi-target" variant="outlined">
          <span className="billing-kpi-icon"><ReceiptText size={20} /></span>
          <div><Typography variant="overline">Expected this period</Typography><Typography className="billing-kpi-value">{money.format(targetAmount)}</Typography><Typography variant="body2">{candidateCount} billable account{candidateCount === 1 ? "" : "s"}</Typography></div>
        </Paper>
        <Paper className={`billing-kpi ${issues ? "billing-kpi-warning" : "billing-kpi-ready"}`} variant="outlined">
          <span className="billing-kpi-icon">{issues ? <AlertTriangle size={20} /> : <CircleCheckBig size={20} />}</span>
          <div><Typography variant="overline">Readiness</Typography><Typography className="billing-kpi-value">{ready} ready · {issues} exception{issues === 1 ? "" : "s"}</Typography><Typography variant="body2">{money.format(readyAmount)} ready · {money.format(issueAmount)} blocked</Typography></div>
        </Paper>
        <Paper className="billing-kpi billing-kpi-generated" variant="outlined">
          <span className="billing-kpi-icon"><CircleCheckBig size={20} /></span>
          <div><Typography variant="overline">Generated this period</Typography><Typography className="billing-kpi-value">{money.format(generatedAmount)}</Typography><Typography variant="body2">{generatedCount} invoice{generatedCount === 1 ? "" : "s"} issued</Typography></div>
        </Paper>
      </Box>
      {generatedAmount > targetAmount && targetAmount > 0 && (
        <Typography className="billing-reconciliation-note" variant="caption">
          Generated includes invoices already issued earlier in this period; expected reflects the current billing queue.
        </Typography>
      )}
    </>
  );
}
