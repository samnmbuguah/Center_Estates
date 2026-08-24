"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { csvCell, csvColumn, normalizeCsvHeader, normalizeDateString, parseCsv } from "@/lib/csv";
import { useAuth } from "@/components/auth-provider";

type SourceRow = Record<string, string>;
type PreviewRow = { row: number; data: SourceRow; errors: Record<string, string> };

const headers = ["tenant_code", "unit_code", "starts_on", "ends_on", "monthly_rent", "billing_day", "escalation_percent", "escalation_interval_months"];

function downloadTemplate() {
  const csv = [
    headers,
    ["TNT-0001", "G-01", "2026-09-01", "2027-08-31", "145000", "1", "10", "12"],
    ["TNT-0002", "F1-02", "01/09/2026", "31/08/2027", "85000", "1", "10", "12"],
  ]
    .map((row) => row.map((value) => `"${value}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "lease-import-template.csv"; link.click();
  URL.revokeObjectURL(url);
}

function readRows(text: string): SourceRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];
  const normalized = parsed[0].map(normalizeCsvHeader);
  return parsed.slice(1).map((row) => {
    const raw = Object.fromEntries(headers.map((header) => [
      header, csvCell(row, csvColumn(normalized, [header])),
    ]));
    if (raw.starts_on) raw.starts_on = normalizeDateString(raw.starts_on);
    if (raw.ends_on) raw.ends_on = normalizeDateString(raw.ends_on);
    return raw;
  }).filter((row) => row.tenant_code || row.unit_code);
}

export function BulkLeaseImporter({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const validCount = preview.filter((row) => Object.keys(row.errors).length === 0).length;

  async function submit(mode: "preview" | "commit") {
    if (!sourceRows.length || !session?.activeOrganizationId) return;
    setBusy(true); setError("");
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/property/leases/bulk-import/", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ mode, rows: sourceRows }),
      }, session.activeOrganizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Lease import could not be processed."));
      const payload = await response.json();
      setPreview(payload.rows ?? []);
      if (mode === "commit") { onDone(); onClose(); setSourceRows([]); setPreview([]); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lease import could not be processed.");
    } finally { setBusy(false); }
  }

  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>Import existing leases</DialogTitle>
    {busy && <LinearProgress />}
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Match existing tenants and units. Deposits and recurring charges are inherited from each unit billing schedule; imported leases remain drafts for review.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Button variant="outlined" onClick={downloadTemplate}>Download template</Button>
        <Button variant="contained" onClick={() => fileRef.current?.click()}>Choose CSV</Button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          const rows = readRows(await file.text()); setSourceRows(rows); setPreview([]);
          if (!rows.length) setError("No lease rows were found. Use the provided template headings.");
        }} />
        {sourceRows.length > 0 && <Button onClick={() => submit("preview")} disabled={busy}>Validate {sourceRows.length} rows</Button>}
      </Box>
      {preview.length > 0 && <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Alert severity={validCount === preview.length ? "success" : "warning"}>
          {validCount} ready; {preview.length - validCount} need correction. Nothing has been saved yet.
        </Alert>
        <Table size="small"><TableHead><TableRow><TableCell>Row</TableCell><TableCell>Tenant</TableCell><TableCell>Unit</TableCell><TableCell>Term</TableCell><TableCell>Rent</TableCell><TableCell>Inherited deposit</TableCell><TableCell>Validation</TableCell></TableRow></TableHead>
          <TableBody>{preview.map((row) => <TableRow key={row.row} sx={Object.keys(row.errors).length ? { bgcolor: "error.lighter" } : undefined}>
            <TableCell>{row.row}</TableCell><TableCell>{row.data.tenant}</TableCell><TableCell>{row.data.unit_code}</TableCell>
            <TableCell>{row.data.starts_on} – {row.data.ends_on}</TableCell><TableCell>{row.data.monthly_rent}</TableCell><TableCell>{row.data.deposit}</TableCell>
            <TableCell>{Object.values(row.errors).join(" ") || "Ready"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Paper>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => submit("commit")} disabled={busy || !preview.length || validCount === 0}>Import {validCount} draft leases</Button></DialogActions>
  </Dialog>;
}
