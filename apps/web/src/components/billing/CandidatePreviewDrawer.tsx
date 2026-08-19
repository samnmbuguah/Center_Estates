"use client";

import { Alert, Box, Stack, Typography } from "@mui/material";
import { DetailDrawer, money } from "@/components/module-ui";
import { Candidate } from "./types";

export function CandidatePreviewDrawer({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  return (
    <DetailDrawer title={`Invoice Preview: ${candidate.tenant_name}`} onClose={onClose}>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2, background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
          <Typography variant="overline" sx={{ fontWeight: 800, color: "var(--primary)" }}>DRAFT INVOICE</Typography>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>{candidate.tenant_name}</Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>{candidate.property_name} — Unit {candidate.unit_code}</Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mt: 0.5 }}>Lease: {candidate.lease_reference} · Due: {candidate.due_date}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Charges</Typography>
          <Stack sx={{ gap: 1 }}>
            {candidate.billing_items.map((item, i) => (
              <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 700 }}>{item.description || item.code}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.code.toUpperCase()}</div></div>
                <div style={{ fontWeight: 800 }}>{money.format(Number(item.total ?? item.amount ?? 0))}</div>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(37,99,235,0.08) 100%)", border: "1.5px solid rgba(59,130,246,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Total Due</Typography>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>{money.format(Number(candidate.total))}</Typography>
        </Box>

        {candidate.issue_summary?.length > 0 && <Alert severity="warning">{candidate.issue_summary.map(i => i.message).join("; ")}</Alert>}

        {candidate.meter_readings && candidate.meter_readings.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Meter Readings</Typography>
            <Stack sx={{ gap: 1 }}>
              {candidate.meter_readings.map((m, i) => (
                <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: 700 }}>{m.meter_type}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Previous: {m.previous} → Current: {m.current}</div></div>
                  <div style={{ fontWeight: 800 }}>{m.units} units</div>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </DetailDrawer>
  );
}
