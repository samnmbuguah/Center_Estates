"use client";

import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BillingMode = "monthly" | "quarterly" | "custom";

export function BillingHeader({
  formattedPeriod,
  runStatus,
  billingTarget = "tenant",
  onBillingTargetChange = () => {},
  onPrev,
  onNext,
}: {
  formattedPeriod: string;
  runStatus: string | null;
  billingTarget?: "tenant" | "landlord";
  onBillingTargetChange?: (target: "tenant" | "landlord") => void;
  mode?: BillingMode;
  onModeChange?: (m: BillingMode) => void;
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
        px: 2,
        py: 1.25,
        borderRadius: 2,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "var(--text)", fontSize: 16 }}>
            Billing Pipeline
          </Typography>
        </Box>

        {/* Tenant vs Landlord Switcher */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: "var(--surface-sunken)",
            borderRadius: 2,
            p: 0.35,
            border: "1px solid var(--border)",
            gap: 0.5,
          }}
        >
          <Button
            size="small"
            onClick={() => onBillingTargetChange("tenant")}
            sx={{
              px: 1.5,
              py: 0.35,
              borderRadius: 1.5,
              fontWeight: 800,
              fontSize: 12,
              textTransform: "none",
              background: billingTarget === "tenant" ? "var(--primary)" : "transparent",
              color: billingTarget === "tenant" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: billingTarget === "tenant" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              "&:hover": {
                background: billingTarget === "tenant" ? "var(--primary)" : "var(--interactive-hover)",
              },
            }}
          >
            👤 Tenant Billing
          </Button>
          <Button
            size="small"
            onClick={() => onBillingTargetChange("landlord")}
            sx={{
              px: 1.5,
              py: 0.35,
              borderRadius: 1.5,
              fontWeight: 800,
              fontSize: 12,
              textTransform: "none",
              background: billingTarget === "landlord" ? "var(--primary)" : "transparent",
              color: billingTarget === "landlord" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: billingTarget === "landlord" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              "&:hover": {
                background: billingTarget === "landlord" ? "var(--primary)" : "var(--interactive-hover)",
              },
            }}
          >
            🏛️ Landlord Billing
          </Button>
        </Box>
      </Box>

      {/* Period Navigator & Status */}
      <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: "var(--surface-sunken)",
            borderRadius: 1.5,
            p: 0.25,
            border: "1px solid var(--border)",
          }}
        >
          <Button size="small" onClick={onPrev} sx={{ minWidth: 28, height: 26, p: 0, color: "var(--text)" }}>
            <ChevronLeft size={16} />
          </Button>
          <Typography sx={{ px: 1, fontWeight: 700, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap" }}>
            {formattedPeriod}
          </Typography>
          <Button size="small" onClick={onNext} sx={{ minWidth: 28, height: 26, p: 0, color: "var(--text)" }}>
            <ChevronRight size={16} />
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
            sx={{ fontWeight: 800, fontSize: 10, height: 22 }}
          />
        )}
      </Stack>
    </Paper>
  );
}
