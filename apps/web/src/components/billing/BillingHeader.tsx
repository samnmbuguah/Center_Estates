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
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "#fff", display: "flex", alignItems: { xs: "stretch", md: "center" },
      justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" },
      boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
    }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Billing Pipeline</Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
          Monthly invoice generation — rent, service charges, and utilities.
        </Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", borderRadius: 2, p: 0.5, border: "1px solid rgba(255,255,255,0.12)" }}>
          <Button size="small" onClick={onPrevMonth} sx={{ minWidth: 32, p: 0.5, color: "#fff" }}><ChevronLeft size={18} /></Button>
          <Typography sx={{ px: 1.5, fontWeight: 700, fontSize: 13, color: "#fff", whiteSpace: "nowrap" }}>{formattedMonth}</Typography>
          <Button size="small" onClick={onNextMonth} sx={{ minWidth: 32, p: 0.5, color: "#fff" }}><ChevronRight size={18} /></Button>
        </Box>
        {runStatus && (
          <Chip size="small" label={runStatus.replace(/_/g, " ").toUpperCase()}
            color={["approved", "generated"].includes(runStatus) ? "success" : runStatus === "review" ? "warning" : "default"}
            sx={{ fontWeight: 800, fontSize: 11, color: "#fff" }} />
        )}
      </Stack>
    </Paper>
  );
}
