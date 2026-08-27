"use client";

import { Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { FilePlus2, Search, User } from "lucide-react";
import { EmptyState, money, StatusPill } from "@/components/module-ui";
import { Candidate, statusToneMap, InvoiceChargeType, CHARGE_TYPE_LABEL, invoiceChargeType, candidateHasChargeType } from "./types";

export function CandidateTable({ candidates, run, search, statusFilter, chargeTypeFilter = "all", typeCounts = {}, selected, allReadySelected, readyCount, busy, formattedMonth, runPeriodStart = "", onSearch, onStatusFilter, onChargeTypeFilter = () => {}, onSelectAll, onSelect, onPreview, onOverride, onSingleInvoice, onNavigate }: {
  candidates: Candidate[]; run: boolean; search: string; statusFilter: string; chargeTypeFilter?: InvoiceChargeType | "all"; typeCounts?: Record<string, number>;
  selected: string[]; allReadySelected: boolean; readyCount: number; busy: string;
  formattedMonth: string; runPeriodStart?: string; onSearch: (v: string) => void; onStatusFilter: (v: string) => void; onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  onSelectAll: () => void; onSelect: (id: string) => void; onPreview: (c: Candidate) => void;
  onOverride: (c: Candidate) => void; onSingleInvoice: () => void; onNavigate: (tab: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Candidate Invoices — {formattedMonth}</Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>Select ready candidates and generate invoices in bulk.</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button size="small" variant="outlined" startIcon={<FilePlus2 size={15} />} onClick={onSingleInvoice}>Single Invoice</Button>
          <Button size="small" variant="outlined" onClick={() => onNavigate("rent")}>Invoice Register →</Button>
          <Button size="small" variant="outlined" onClick={() => onNavigate("payments")}>Payments →</Button>
        </Stack>
      </Box>

      {run && (
        <Box sx={{ px: 2, py: 1, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", background: "var(--surface)" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--text-secondary)", mr: 0.5 }}>Invoice type:</Typography>
          {([{ key: "all", label: "All types" }, { key: "rent", label: `Rent${typeCounts.rent ? ` (${typeCounts.rent})` : ""}` }, { key: "service_charge", label: `Service charge${typeCounts.service_charge ? ` (${typeCounts.service_charge})` : ""}` }, { key: "utility", label: `Utilities${typeCounts.utility ? ` (${typeCounts.utility})` : ""}` }] as const).map((t) => (
            <Chip
              key={t.key}
              size="small"
              label={t.label}
              clickable
              onClick={() => onChargeTypeFilter(t.key)}
              color={chargeTypeFilter === t.key ? "primary" : "default"}
              variant={chargeTypeFilter === t.key ? "filled" : "outlined"}
              sx={{ fontWeight: chargeTypeFilter === t.key ? 700 : 500, fontSize: 12 }}
            />
          ))}
          {chargeTypeFilter !== "all" && (
            <Typography variant="caption" sx={{ color: "var(--text-secondary)", ml: 1 }}>
              Only {CHARGE_TYPE_LABEL[chargeTypeFilter]} invoices will be generated; other charges are hidden and skipped.
            </Typography>
          )}
        </Box>
      )}

      {run && (
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, background: "var(--bg-app)" }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", flex: 1, minWidth: 240 }}>
            <TextField size="small" placeholder="Search tenant, unit, lease…" value={search} onChange={(e) => onSearch(e.target.value)} slotProps={{ input: { startAdornment: <Search size={16} style={{ marginRight: 8, color: "var(--text-secondary)" }} />, sx: { borderRadius: 2, background: "var(--surface)", fontSize: 13 } } }} sx={{ flex: 1, maxWidth: 320 }} />
            <TextField select size="small" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)} sx={{ minWidth: 130 }} slotProps={{ input: { sx: { borderRadius: 2, background: "var(--surface)", fontSize: 13 } } }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="issue">Issues</MenuItem>
              <MenuItem value="generated">Generated</MenuItem>
              <MenuItem value="excluded">Excluded</MenuItem>
            </TextField>
          </Stack>
          {readyCount > 0 && (
            <FormControlLabel control={<Checkbox size="small" checked={allReadySelected} onChange={onSelectAll} />} label={<Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12 }}>Select All Ready ({readyCount})</Typography>} />
          )}
        </Box>
      )}

      {busy && <LinearProgress />}

      {!run ? (
        <EmptyState title="No Billing Run" description={`Click "Initialize ${formattedMonth}" above to start the billing pipeline.`} />
      ) : candidates.length === 0 ? (
        chargeTypeFilter !== "all" ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No {CHARGE_TYPE_LABEL[chargeTypeFilter]} invoices in this view</Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              {Object.entries(typeCounts).filter(([k, v]) => k !== chargeTypeFilter && v > 0).length
                ? `Try: ${Object.entries(typeCounts).filter(([k, v]) => k !== chargeTypeFilter && v > 0).map(([k, v]) => `${CHARGE_TYPE_LABEL[k as keyof typeof CHARGE_TYPE_LABEL]} (${v})`).join(" · ")} — or switch back to All types.`
                : "Try clearing your search or switching back to All types."}
            </Typography>
            <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => onChargeTypeFilter("all")}>Show all types</Button>
          </Box>
        ) : (
          <EmptyState title="No Matching Candidates" description="Try clearing your search or adjusting filters." />
        )
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", width: 40 }}></th>
                <th style={{ padding: "10px 14px" }}>Tenant & Lease</th>
                <th style={{ padding: "10px 14px" }}>Unit</th>
                <th style={{ padding: "10px 14px" }}>Charges</th>
                <th style={{ padding: "10px 14px" }}>Total Due</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isSelected = selected.includes(c.id);
                const isReady = c.status === "ready";
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "rgba(59,130,246,0.04)" : "transparent" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <input type="checkbox" disabled={!isReady} checked={isSelected} onChange={() => onSelect(c.id)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><User size={14} style={{ color: "var(--text-secondary)" }} /></div>
                        <div><div style={{ fontWeight: 700 }}>{c.tenant_name}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.lease_reference}</div></div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}><div style={{ fontWeight: 600, fontSize: 12 }}>{c.unit_code}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.property_name}</div></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {c.billing_items.map((item, i) => {
                          const t = invoiceChargeType(item.code);
                          const isMatch = chargeTypeFilter === "all" || t === chargeTypeFilter || (chargeTypeFilter === "utility" && (t === "utility"));
                          const isUtilityMatch = chargeTypeFilter === "utility" && (String(item.code).toLowerCase() === "water" || String(item.code).toLowerCase() === "electricity");
                          const show = chargeTypeFilter === "all" || isMatch || isUtilityMatch;
                          return (
                            <Chip
                              key={i}
                              size="small"
                              label={item.code.replace(/_/g, " ")}
                              variant={show ? "filled" : "outlined"}
                              color={show ? "primary" : "default"}
                              sx={{ fontSize: 10, height: 20, opacity: show ? 1 : 0.45, fontWeight: show ? 600 : 400 }}
                            />
                          );
                        })}
                      </div>
                      {(() => {
                        const dup = c.issue_summary?.find((x) => String(x.code).toLowerCase().includes("duplicate"));
                        if (!dup) return c.issue_summary?.length ? <div style={{ fontSize: 11, color: dup ? "#d97706" : "#ef4444", marginTop: 4 }}>{c.issue_summary[0].message}</div> : null;
                        // Duplicate is now a warning: show as amber and note already-billed types will be skipped.
                        const willSkip = chargeTypeFilter !== "all";
                        return <div style={{ fontSize: 11, color: "#d97706", marginTop: 4 }}>{dup.message}{willSkip ? " — already-billed types will be skipped." : ""}</div>;
                      })()}
                      {chargeTypeFilter !== "all" && c.billing_items.filter((it) => {
                        const t = invoiceChargeType(it.code);
                        return chargeTypeFilter === "utility" ? t === "utility" : t === chargeTypeFilter;
                      }).length === 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>No {CHARGE_TYPE_LABEL[chargeTypeFilter]} charges in this candidate — hidden by filter.</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {(() => {
                        if (chargeTypeFilter === "all") return <div style={{ fontWeight: 800 }}>{money.format(Number(c.total))}</div>;
                        const matching = c.billing_items.filter((it) => {
                          const t = invoiceChargeType(it.code);
                          return chargeTypeFilter === "utility" ? t === "utility" : t === chargeTypeFilter;
                        });
                        if (!matching.length) return <div style={{ fontWeight: 800, color: "var(--text-secondary)" }}>{money.format(Number(c.total))}</div>;
                        const filteredTotal = matching.reduce((s, it) => s + Number(it.total ?? it.amount ?? 0), 0);
                        return (
                          <>
                            <div style={{ fontWeight: 800 }}>{money.format(filteredTotal)}</div>
                            {matching.length !== c.billing_items.length && <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>of {money.format(Number(c.total))} total</div>}
                          </>
                        );
                      })()}
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Due: {c.due_date}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {(() => {
                        const dup = c.issue_summary?.find((x) => String(x.code).toLowerCase().includes("duplicate"));
                        if (dup && c.status === "ready") return <StatusPill tone="yellow">ready · already billed</StatusPill>;
                        return <StatusPill tone={statusToneMap[c.status] || "gray"}>{c.status}</StatusPill>;
                      })()}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Button size="small" onClick={() => onPreview(c)}>Preview</Button>
                        {c.status === "issue" && <Button size="small" color="warning" onClick={() => onOverride(c)}>Override</Button>}
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
