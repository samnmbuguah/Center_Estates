"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Box, Paper, Typography, Chip, Stack } from "@mui/material";
import { AlertCircle, Building2, CheckCircle2, Droplets, ListChecks, ReceiptText, Zap } from "lucide-react";
import { Candidate, InvoiceChargeType, invoiceChargeType } from "./types";
import { money } from "@/components/module-ui";

interface ChargeSummary {
  type: InvoiceChargeType | "management_fee";
  label: string;
  icon: ReactNode;
  color: string;
  totalCount: number;
  billedCount: number;
  pendingCount: number;
  totalAmount: number;
  billedAmount: number;
  pendingAmount: number;
}

export function BillingChargeRollup({
  candidates = [],
  activeFilter = "all",
  billingTarget = "tenant",
  onSelectFilter,
}: {
  candidates: Candidate[];
  activeFilter: InvoiceChargeType | "all";
  billingTarget?: "tenant" | "landlord";
  onSelectFilter?: (type: InvoiceChargeType | "all") => void;
}) {
  const summaries = useMemo<ChargeSummary[]>(() => {
    if (billingTarget === "landlord") {
      let totalAmount = 0;
      let billedAmount = 0;
      let billedCount = 0;
      const totalCount = candidates.length;

      for (const cand of candidates) {
        const amt = Number(cand.total || 0);
        totalAmount += amt;
        const isBilled = cand.status === "generated" || cand.billing_items.some((i) => i.billed);
        if (isBilled) {
          billedCount += 1;
          billedAmount += amt;
        }
      }

      return [
        {
          type: "management_fee",
          label: "Management Fees",
          icon: <Building2 size={17} />,
          color: "var(--color-amber)",
          totalCount,
          billedCount,
          pendingCount: Math.max(0, totalCount - billedCount),
          totalAmount,
          billedAmount,
          pendingAmount: Math.max(0, totalAmount - billedAmount),
        },
      ];
    }

    const hasElectricity = candidates.some((cand) =>
      (cand.billing_items || []).some((it) => (it.code || "").toLowerCase().includes("electr"))
    );

    const typeConfigs: Array<{ type: InvoiceChargeType; label: string; icon: ReactNode; color: string }> = [
      { type: "rent", label: "Rent", icon: <Building2 size={17} />, color: "var(--color-blue)" },
      { type: "service_charge", label: "Service charge", icon: <ReceiptText size={17} />, color: "var(--color-violet-strong)" },
      { type: "utility", label: hasElectricity ? "Utilities (Electricity)" : "Utilities", icon: hasElectricity ? <Zap size={17} /> : <Droplets size={17} />, color: hasElectricity ? "#d97706" : "#06b6d4" },
      { type: "other", label: "Other charges", icon: <ListChecks size={17} />, color: "var(--text-faint)" },
    ];

    return typeConfigs.map((config) => {
      let totalCount = 0;
      let billedCount = 0;
      let totalAmount = 0;
      let billedAmount = 0;

      for (const cand of candidates) {
        const matchingItems = cand.billing_items.filter((it) => invoiceChargeType(it.code) === config.type);
        if (matchingItems.length > 0) {
          totalCount += 1;
          const allItemBilled = matchingItems.every((it) => it.billed || Boolean(it.invoice_number) || Boolean(it.invoice_id));
          const candAmt = matchingItems.reduce((s, it) => s + Number(it.total || it.amount || 0), 0);
          totalAmount += candAmt;

          if (allItemBilled) {
            billedCount += 1;
            billedAmount += candAmt;
          }
        }
      }

      return {
        type: config.type,
        label: config.label,
        icon: config.icon,
        color: config.color,
        totalCount,
        billedCount,
        pendingCount: Math.max(0, totalCount - billedCount),
        totalAmount,
        billedAmount,
        pendingAmount: Math.max(0, totalAmount - billedAmount),
      };
    });
  }, [candidates, billingTarget]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>
          Charge completion
        </Typography>
        {activeFilter !== "all" && (
          <button
            className="btn ghost sm"
            style={{ fontSize: 11, height: 22, padding: "2px 8px" }}
            onClick={() => onSelectFilter?.("all")}
          >
            Show All Items (Clear Filter)
          </button>
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: summaries.length === 1 ? "1fr" : "repeat(2, 1fr)",
            md: summaries.length === 1 ? "1fr" : "repeat(4, 1fr)",
          },
          gap: 1.25,
        }}
      >
        {summaries.map((sum) => {
          const isSelected = activeFilter === sum.type;
          const isComplete = sum.totalCount > 0 && sum.pendingCount === 0;
          const isNoneDue = sum.totalCount === 0;

          return (
            <Paper
              key={sum.type}
              variant="outlined"
              onClick={() => {
                if (sum.type !== "management_fee") {
                  onSelectFilter?.(isSelected ? "all" : (sum.type as InvoiceChargeType));
                }
              }}
              sx={{
                p: 1.5,
                borderRadius: 2,
                cursor: sum.type !== "management_fee" ? "pointer" : "default",
                border: isSelected ? `2px solid ${sum.color}` : "1px solid var(--border)",
                background: isSelected ? "rgba(79, 70, 229, 0.04)" : "var(--surface)",
                transition: "all 0.15s ease-in-out",
                "&:hover": {
                  borderColor: sum.color,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                },
              }}
            >
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span className="billing-rollup-icon">{sum.icon}</span>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 12.5 }}>
                    {sum.label}
                  </Typography>
                </Stack>

                {isNoneDue ? (
                  <Chip
                    size="small"
                    label="Not Scheduled"
                    sx={{ fontSize: 9.5, height: 20, bgcolor: "rgba(100, 116, 139, 0.1)", color: "var(--text-secondary)", fontWeight: 700 }}
                  />
                ) : isComplete ? (
                  <Chip
                    size="small"
                    icon={<CheckCircle2 size={11} color="var(--color-success)" />}
                    label="100% Invoiced"
                    sx={{ fontSize: 9.5, height: 20, bgcolor: "rgba(22, 163, 74, 0.1)", color: "var(--color-success)", fontWeight: 700 }}
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={sum.type === "utility" ? <Zap size={11} color="var(--color-orange)" /> : <AlertCircle size={11} color="var(--color-orange)" />}
                    label={sum.type === "utility" && sum.totalAmount === 0 ? `${sum.pendingCount} Readings Req.` : `${sum.pendingCount} Pending`}
                    sx={{ fontSize: 9.5, height: 20, bgcolor: "rgba(234, 88, 12, 0.1)", color: "var(--color-orange)", fontWeight: 700 }}
                  />
                )}
              </Box>

              {/* Counts & Value */}
              <Box sx={{ mt: 1 }}>
                {isNoneDue ? (
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11, display: "block" }}>
                    No recurring charges scheduled for this period (e.g. quarterly cycle).
                  </Typography>
                ) : (
                  <>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                        <strong>{sum.billedCount}</strong> of <strong>{sum.totalCount}</strong> tenants billed
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: isComplete ? "var(--color-success)" : "var(--text)", fontSize: 12 }}>
                        {money.format(sum.billedAmount)}
                      </Typography>
                    </Box>

                    {sum.pendingCount > 0 && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mt: 0.5, gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "var(--color-orange)", fontWeight: 600, fontSize: 10.5, whiteSpace: "nowrap" }}>
                          Remaining: {sum.pendingCount} tenants
                        </Typography>
                        <Typography variant="caption" sx={{ color: "var(--color-orange)", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>
                          {sum.pendingAmount > 0 ? money.format(sum.pendingAmount) : (sum.type === "utility" ? "Awaiting readings" : money.format(0))}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
