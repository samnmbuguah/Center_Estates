"use client";

import { Box, Button, Chip, IconButton, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { Building2, CalendarRange, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";

export type BillingMode = "monthly" | "quarterly" | "custom";

export function BillingHeader({
  formattedPeriod,
  runStatus,
  billingTarget = "tenant",
  onBillingTargetChange = () => {},
  customPeriod = false,
  onCustomPeriodChange = () => {},
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
  customPeriod?: boolean;
  onCustomPeriodChange?: (custom: boolean) => void;
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
        <Typography variant="body2">Prepare and issue recurring charges.</Typography>
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

        {customPeriod ? (
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

        <Button
          size="small"
          variant={customPeriod ? "contained" : "text"}
          startIcon={<Clock size={14} />}
          onClick={() => onCustomPeriodChange(!customPeriod)}
          sx={{ minHeight: 36, fontSize: 12, fontWeight: 750, textTransform: "none" }}
        >
          Custom period
        </Button>

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
