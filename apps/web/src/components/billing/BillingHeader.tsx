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

      {/* Mode Switcher */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ gap: 1.5, alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap" }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: "var(--surface-sunken)",
            borderRadius: 2,
            p: 0.5,
            border: "1px solid var(--border)",
            gap: 0.5,
          }}
        >
          <Button
            size="small"
            variant={mode === "monthly" ? "contained" : "text"}
            onClick={() => onModeChange("monthly")}
            startIcon={<Calendar size={14} />}
            sx={{
              fontWeight: 700,
              fontSize: 12,
              px: 1.2,
              py: 0.4,
              minWidth: 0,
              borderRadius: 1.5,
              textTransform: "none",
            }}
          >
            Monthly
          </Button>
          <Button
            size="small"
            variant={mode === "quarterly" ? "contained" : "text"}
            onClick={() => onModeChange("quarterly")}
            startIcon={<Layers size={14} />}
            sx={{
              fontWeight: 700,
              fontSize: 12,
              px: 1.2,
              py: 0.4,
              minWidth: 0,
              borderRadius: 1.5,
              textTransform: "none",
            }}
          >
            Quarterly (Q1–Q4)
          </Button>
          <Button
            size="small"
            variant={mode === "custom" ? "contained" : "text"}
            onClick={() => onModeChange("custom")}
            startIcon={<Clock size={14} />}
            sx={{
              fontWeight: 700,
              fontSize: 12,
              px: 1.2,
              py: 0.4,
              minWidth: 0,
              borderRadius: 1.5,
              textTransform: "none",
            }}
          >
            Multi-Month / Catch-up
          </Button>
        </Box>

        {/* Date Navigator */}
        {mode !== "custom" ? (
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
            <Typography sx={{ px: 1.5, fontWeight: 700, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" }}>
              {formattedPeriod}
            </Typography>
            <Button size="small" onClick={onNext} sx={{ minWidth: 32, p: 0.5, color: "var(--text)" }}>
              <ChevronRight size={18} />
            </Button>
          </Box>
        ) : (
          <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
            <TextField
              size="small"
              type="month"
              label="From"
              value={customStart}
              onChange={(e) => onCustomStartChange?.(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 140, "& input": { fontSize: 13, py: 0.8 } }}
            />
            <Typography sx={{ fontWeight: 700, color: "var(--text-secondary)" }}>to</Typography>
            <TextField
              size="small"
              type="month"
              label="To"
              value={customEnd}
              onChange={(e) => onCustomEndChange?.(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 140, "& input": { fontSize: 13, py: 0.8 } }}
            />
          </Stack>
        )}

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
