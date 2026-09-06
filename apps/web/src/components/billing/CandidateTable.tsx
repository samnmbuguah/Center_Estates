"use client";

import { Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { Eye, Search, User } from "lucide-react";
import { EmptyState, money, StatusPill } from "@/components/module-ui";
import { Candidate, statusToneMap, InvoiceChargeType, invoiceChargeType } from "./types";

export function CandidateTable({
  candidates,
  run,
  search,
  statusFilter,
  chargeTypeFilter = "all",
  billingTarget = "tenant",
  typeCounts = {},
  selected,
  allReadySelected,
  readyCount,
  busy,
  formattedMonth,
  onSearch,
  onStatusFilter,
  onChargeTypeFilter = () => {},
  onSelectAll,
  onSelect,
  onPreview,
  onOverride,
  onNavigate,
}: {
  candidates: Candidate[];
  run: boolean;
  search: string;
  statusFilter: string;
  chargeTypeFilter?: InvoiceChargeType | "all";
  billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>;
  selected: string[];
  allReadySelected: boolean;
  readyCount: number;
  busy: string;
  formattedMonth: string;
  runPeriodStart?: string;
  onSearch: (v: string) => void;
  onStatusFilter: (v: string) => void;
  onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  onSelectAll: () => void;
  onSelect: (id: string) => void;
  onPreview: (c: Candidate) => void;
  onOverride: (c: Candidate) => void;
  onSingleInvoice: () => void;
  onNavigate: (tab: string) => void;
}) {
  return (
    <Paper className="billing-candidate-card" variant="outlined">
      {/* Header Toolbar */}
      <Box className="billing-candidate-header">
        <Box>
          <Typography variant="subtitle1">
            {billingTarget === "landlord" ? "Landlord fee candidates" : "Candidate invoices"} — {formattedMonth}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {billingTarget === "landlord"
              ? "Automated management commissions, agency letting fees, and pass-through recoveries for property owners."
              : "Automated charge detection: billed items are tracked, remaining unbilled items are ready for dispatch."}
          </Typography>
        </Box>
        <Button size="small" variant="text" onClick={() => onNavigate("rent")}>View invoice register</Button>
      </Box>

      {run && (
        <Box className="billing-filter-toolbar">
          <Stack className="billing-charge-filters" direction="row">
            {([
              { key: "all", label: "All charges" },
              { key: "rent", label: `Rent${typeCounts.rent ? ` (${typeCounts.rent})` : ""}` },
              { key: "service_charge", label: `Service charge${typeCounts.service_charge ? ` (${typeCounts.service_charge})` : ""}` },
              { key: "utility", label: `Utilities${typeCounts.utility ? ` (${typeCounts.utility})` : ""}` },
            ] as const).map((item) => <Chip key={item.key} size="small" label={item.label} clickable onClick={() => onChargeTypeFilter(item.key)} color={chargeTypeFilter === item.key ? "primary" : "default"} variant={chargeTypeFilter === item.key ? "filled" : "outlined"} />)}
          </Stack>
          <Stack className="billing-search-controls" direction="row">
            <TextField
              size="small"
              placeholder="Search tenant, unit, lease…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <Search size={14} style={{ marginRight: 6, color: "var(--text-secondary)" }} />,
                  sx: { borderRadius: 1.5, background: "var(--surface)", fontSize: 12, height: 32 },
                },
              }}
              sx={{ flex: 1, minWidth: 220 }}
            />
            <TextField
              select
              size="small"
              value={statusFilter}
              onChange={(e) => onStatusFilter(e.target.value)}
              sx={{ minWidth: 110 }}
              slotProps={{ input: { sx: { borderRadius: 1.5, background: "var(--surface)", fontSize: 12, height: 32 } } }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="ready">Ready ({readyCount})</MenuItem>
              <MenuItem value="issue">Issues</MenuItem>
              <MenuItem value="generated">Generated (Billed)</MenuItem>
              <MenuItem value="excluded">Excluded</MenuItem>
            </TextField>
          </Stack>
          {readyCount > 0 && (
            <FormControlLabel
              control={<Checkbox size="small" checked={allReadySelected} onChange={onSelectAll} />}
              label={<Typography variant="body2" sx={{ fontWeight: 700, fontSize: 11.5 }}>Select All Ready ({readyCount})</Typography>}
            />
          )}
        </Box>
      )}

      {busy && <LinearProgress />}

      {!run ? (
        <EmptyState title="No Billing Run" description={`Click "Scan & Start ${formattedMonth}" above to initialize the billing queue.`} />
      ) : candidates.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>No matching candidate invoices</Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5, fontSize: 12 }}>
            Try switching to &quot;All Types&quot; or re-scanning the queue.
          </Typography>
          <Button size="small" variant="outlined" sx={{ mt: 1.5, fontSize: 11 }} onClick={() => onChargeTypeFilter("all")}>Show all types</Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <table className="fc-data-table billing-candidate-table">
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", width: 36 }}></th>
                <th style={{ padding: "8px 12px" }}>Tenant & Lease</th>
                <th style={{ padding: "8px 12px" }}>Unit</th>
                <th style={{ padding: "8px 12px" }}>Billable Items</th>
                <th style={{ padding: "8px 12px" }}>Remaining Due</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isSelected = selected.includes(c.id);
                const unbilledItems = (c.billing_items || []).filter((it: any) => !it.billed);
                const isReady = c.status === "ready" || (unbilledItems.length > 0 && c.status !== "issue");
                const unbilledTotal = unbilledItems.reduce((s: number, it: any) => s + Number(it.total || it.amount || 0), 0);
                const billedTotal = (c.billing_items || []).filter((it: any) => it.billed).reduce((s: number, it: any) => s + Number(it.total || it.amount || 0), 0);

                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "rgba(59,130,246,0.04)" : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        type="checkbox"
                        disabled={!isReady}
                        checked={isSelected}
                        onChange={() => onSelect(c.id)}
                        style={{ cursor: isReady ? "pointer" : "default", width: 15, height: 15 }}
                      />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <User size={13} style={{ color: "var(--text-secondary)" }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text)" }}>{c.tenant_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.lease_reference}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>{c.unit_code}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>{c.property_name}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(() => {
                          const grouped = new Map<string, { code: string; rawCode: string; billedCount: number; totalCount: number; unbilledAmount: number }>();
                          for (const it of c.billing_items || []) {
                            const rawCode = String(it.code || "charge");
                            const displayCode = rawCode.replace(/_/g, " ").toUpperCase();
                            const entry = grouped.get(displayCode) || { code: displayCode, rawCode, billedCount: 0, totalCount: 0, unbilledAmount: 0 };
                            entry.totalCount += 1;
                            if (it.billed) {
                              entry.billedCount += 1;
                            } else {
                              entry.unbilledAmount += Number(it.total || it.amount || 0);
                            }
                            grouped.set(displayCode, entry);
                          }

                          return Array.from(grouped.values()).map((grp, i) => {
                            const t = invoiceChargeType(grp.rawCode);
                            const isMatch = chargeTypeFilter === "all" || t === chargeTypeFilter || (chargeTypeFilter === "utility" && t === "utility");
                            const isAllBilled = grp.billedCount === grp.totalCount;
                            const label = isAllBilled
                              ? `${grp.code} ✓`
                              : `${grp.code} · ${money.format(grp.unbilledAmount)}`;

                            return (
                              <Chip
                                key={i}
                                size="small"
                                label={label}
                                variant={isAllBilled ? "outlined" : isMatch ? "filled" : "outlined"}
                                color={isAllBilled ? "success" : isMatch ? "primary" : "default"}
                                sx={{
                                  fontSize: 9.5,
                                  height: 20,
                                  fontWeight: isMatch ? 700 : 500,
                                  opacity: isMatch ? 1 : 0.6,
                                  bgcolor: isAllBilled ? "rgba(34,197,94,0.08)" : undefined,
                                  borderColor: isAllBilled ? "rgba(34,197,94,0.4)" : undefined,
                                }}
                              />
                            );
                          });
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {unbilledTotal > 0 ? (
                        <>
                          <div style={{ fontWeight: 800, fontSize: 12.5, color: "var(--primary)" }}>
                            {money.format(unbilledTotal)}
                          </div>
                          {billedTotal > 0 && (
                            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                              ({money.format(billedTotal)} billed ✓)
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--success)" }}>
                          ✓ Fully Billed ({money.format(Number(c.total))})
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <StatusPill tone={unbilledTotal === 0 ? "green" : statusToneMap[c.status] || "gray"}>
                        {unbilledTotal === 0 ? "generated" : c.status}
                      </StatusPill>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Button variant="outlined" size="small" startIcon={<Eye size={14} />} onClick={() => onPreview(c)}>View details</Button>
                        {c.status === "issue" && (
                          <Button size="small" color="warning" onClick={() => onOverride(c)} sx={{ fontSize: 11, py: 0.25 }}>Override</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}
    </Paper>
  );
}
