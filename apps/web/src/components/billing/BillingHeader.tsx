"use client";

import { Box, Button, Chip, Paper, Stack, Typography, TextField } from "@mui/material";
import { ChevronLeft, ChevronRight, Calendar, Layers, Clock } from "lucide-react";

export type BillingMode = "monthly" | "quarterly" | "custom";

export function BillingHeader({
  formattedPeriod,
  runStatus,
  mode,
  onModeChange,
  onPrev,
  onNext,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  formattedPeriod: string;
  runStatus: string | null;
  mode: BillingMode;
  onModeChange: (m: BillingMode) => void;
  onPrev: () => void;
  onNext: () => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        display: "flex",
        alignItems: { xs: "stretch", md: "center" },
        justifyContent: "space-between",
        gap: 2,
        flexDirection: { xs: "column", md: "row" },
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900, color: "var(--text)" }}>
          Billing Pipeline
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.25 }}>
          Bulk invoice generation — rent, service charges, and utilities.
        </Typography>
      </Box>

      {/* Period Navigator & Status */}
      <Stack
        direction="row"
        sx={{ gap: 1.5, alignItems: "center", flexWrap: "wrap" }}
      >
        {/* Date Navigator */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: "var(--surface-sunken)",
            borderRadius: 2,
            p: 0.5,
            border: "1px solid var(--border)",
          }}
        >
          <Button size="small" onClick={onPrev} sx={{ minWidth: 32, p: 0.5, color: "var(--text)" }}>
            <ChevronLeft size={18} />
          </Button>
          <Typography sx={{ px: 1.5, fontWeight: 800, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" }}>
            {formattedPeriod}
          </Typography>
          <Button size="small" onClick={onNext} sx={{ minWidth: 32, p: 0.5, color: "var(--text)" }}>
            <ChevronRight size={18} />
          </Button>
        </Box>

        {runStatus && (
          <Chip
            size="small"
            label={runStatus.replace(/_/g, " ").toUpperCase()}
            color={
              ["approved", "generated"].includes(runStatus)
                ? "success"
                : runStatus === "review"
                ? "warning"
                : "default"
            }
            sx={{ fontWeight: 800, fontSize: 11 }}
          />
        )}
      </Stack>
    </Paper>
  );
}
