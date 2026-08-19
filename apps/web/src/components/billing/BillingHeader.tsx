"use client";

import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function BillingHeader({ formattedMonth, runStatus, onPrevMonth, onNextMonth }: {
  formattedMonth: string; runStatus: string | null;
  onPrevMonth: () => void; onNextMonth: () => void;
}) {
  return (
    <Paper elevation={0} sx={{
      p: { xs: 2, md: 2.5 }, borderRadius: 3,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      color: "var(--text)", display: "flex", alignItems: { xs: "stretch", md: "center" },
      justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" },
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900, color: "var(--text)" }}>Billing Pipeline</Typography>
        <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.25 }}>
          Monthly invoice generation — rent, service charges, and utilities.
        </Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", background: "var(--surface-sunken)", borderRadius: 2, p: 0.5, border: "1px solid var(--border)" }}>
          <Button size="small" onClick={onPrevMonth} sx={{ minWidth: 32, p: 0.5, color: "var(--text)" }}><ChevronLeft size={18} /></Button>
          <Typography sx={{ px: 1.5, fontWeight: 700, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" }}>{formattedMonth}</Typography>
          <Button size="small" onClick={onNextMonth} sx={{ minWidth: 32, p: 0.5, color: "var(--text)" }}><ChevronRight size={18} /></Button>
        </Box>
        {runStatus && (
          <Chip size="small" label={runStatus.replace(/_/g, " ").toUpperCase()}
            color={["approved", "generated"].includes(runStatus) ? "success" : runStatus === "review" ? "warning" : "default"}
            sx={{ fontWeight: 800, fontSize: 11 }} />
        )}
      </Stack>
    </Paper>
  );
}
