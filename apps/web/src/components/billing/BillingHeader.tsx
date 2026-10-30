"use client";

import { Box, Chip, IconButton, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { Building2, CalendarRange, ChevronLeft, ChevronRight, Clock, Layers, Users } from "lucide-react";

export type BillingMode = "monthly" | "quarterly" | "custom";

export function BillingHeader({
  formattedPeriod,
  runStatus,
  billingTarget = "tenant",
  onBillingTargetChange = () => {},
  mode = "monthly",
  onModeChange = () => {},
  onPrev,
  onNext,
  customStart = "",
  customEnd = "",
  onCustomStartChange,
  onCustomEndChange,
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
  const status = runStatus?.replace(/_/g, " ") ?? "Not started";

  return (
    <Paper className="billing-control-bar" elevation={0}>
      <Box className="billing-control-copy">
        <Typography component="h2" variant="subtitle1">Billing pipeline</Typography>
        <Typography variant="body2">Prepare, review and dispatch recurring charges for the selected property.</Typography>
      </Box>

      <Stack className="billing-control-actions" direction="row">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={billingTarget}
          onChange={(_, value: "tenant" | "landlord" | null) => value && onBillingTargetChange(value)}
          aria-label="Invoice recipient type"
        >
          <ToggleButton value="tenant" aria-label="Tenant billing"><Users size={16} /> Tenant</ToggleButton>
          <ToggleButton value="landlord" aria-label="Landlord billing"><Building2 size={16} /> Landlord</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, value: BillingMode | null) => value && onModeChange(value)}
          aria-label="Billing frequency"
        >
          <ToggleButton value="monthly" aria-label="Monthly billing"><CalendarRange size={16} /> Monthly</ToggleButton>
          <ToggleButton value="quarterly" aria-label="Quarterly billing"><Layers size={16} /> Quarterly</ToggleButton>
          <ToggleButton value="custom" aria-label="Multi-month billing"><Clock size={16} /> Multi-month</ToggleButton>
        </ToggleButtonGroup>

        {mode === "custom" ? (
          <Box className="billing-custom-period" aria-label="Custom billing period">
            <TextField
              type="month"
              size="small"
              label="From"
              value={customStart}
              onChange={(event) => onCustomStartChange?.(event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-label": "Custom billing period start" } }}
            />
            <Typography component="span">to</Typography>
            <TextField
              type="month"
              size="small"
              label="To"
              value={customEnd}
              onChange={(event) => onCustomEndChange?.(event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-label": "Custom billing period end" } }}
            />
          </Box>
        ) : (
          <Box className="billing-period-control" aria-label={`Billing period ${formattedPeriod}`}>
            <Tooltip title="Previous billing period"><IconButton size="small" onClick={onPrev} aria-label="Previous billing period"><ChevronLeft size={17} /></IconButton></Tooltip>
            <CalendarRange size={16} aria-hidden="true" />
            <Typography>{formattedPeriod}</Typography>
            <Tooltip title="Next billing period"><IconButton size="small" onClick={onNext} aria-label="Next billing period"><ChevronRight size={17} /></IconButton></Tooltip>
          </Box>
        )}

        <Chip
          className="billing-run-status"
          size="small"
          label={status}
          color={["approved", "generated"].includes(runStatus ?? "") ? "success" : runStatus === "review" ? "warning" : "default"}
        />
      </Stack>
    </Paper>
  );
}
