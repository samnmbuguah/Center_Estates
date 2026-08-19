"use client";

import { Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { FilePlus2, Search, User } from "lucide-react";
import { EmptyState, money, StatusPill } from "@/components/module-ui";
import { Candidate, statusToneMap } from "./types";

export function CandidateTable({ candidates, run, search, statusFilter, selected, allReadySelected, readyCount, busy, formattedMonth, onSearch, onStatusFilter, onSelectAll, onSelect, onPreview, onOverride, onSingleInvoice, onNavigate }: {
  candidates: Candidate[]; run: boolean; search: string; statusFilter: string;
  selected: string[]; allReadySelected: boolean; readyCount: number; busy: string;
  formattedMonth: string; onSearch: (v: string) => void; onStatusFilter: (v: string) => void;
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
        <EmptyState title="No Matching Candidates" description="Try clearing your search or adjusting filters." />
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
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{c.billing_items.map((item, i) => <Chip key={i} size="small" label={item.code.replace(/_/g, " ")} sx={{ fontSize: 10, height: 20 }} />)}</div>
                      {c.issue_summary?.length > 0 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{c.issue_summary[0].message}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}><div style={{ fontWeight: 800 }}>{money.format(Number(c.total))}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Due: {c.due_date}</div></td>
                    <td style={{ padding: "12px 14px" }}><StatusPill tone={statusToneMap[c.status] || "gray"}>{c.status}</StatusPill></td>
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
