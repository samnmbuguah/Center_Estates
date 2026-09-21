"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { csvCell, csvColumn, normalizeCsvHeader, normalizeDateString, parseCsv } from "@/lib/csv";
import { useAuth } from "@/components/auth-provider";

type SourceRow = Record<string, string>;
type PreviewRow = { row: number; data: SourceRow; errors: Record<string, string> };

const headers = ["tenant_code", "unit_code", "starts_on", "ends_on", "monthly_rent", "service_charge", "billing_day", "escalation_percent", "escalation_interval_months"];

function downloadTemplate() {
  const csv = [
    headers,
    ["TNT-0001", "A-101", "2026-09-01", "2027-08-31", "25000", "0", "1", "0", "12"],
    ["TNT-0002", "B-201", "01/09/2026", "31/08/2027", "50000", "0", "1", "0", "12"],
    ["TNT-0003", "G-01", "2026-09-01", "2028-08-31", "85000", "15000", "1", "10", "12"],
  ]
    .map((row) => row.map((value) => `"${value}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "lease-import-template.csv"; link.click();
  URL.revokeObjectURL(url);
}

function rowsFromGrid(parsed: string[][]): SourceRow[] {
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

function readRows(text: string): SourceRow[] {
  return rowsFromGrid(parseCsv(text));
}

async function readImportFile(file: File): Promise<SourceRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return readRows(await file.text());
  if (extension !== "xlsx") {
    throw new Error("Choose a CSV or Excel workbook (.xlsx).");
  }

  // Load the parser only when an Excel workbook is selected, keeping ordinary
  // lease-page loads small. read-excel-file returns text, numeric and Date
  // cells; converting each populated value to text keeps the existing CSV
  // validation path and date normalisation consistent.
  const { default: readXlsxFile } = await import("read-excel-file");
  const workbookRows = await readXlsxFile(file);
  return rowsFromGrid(workbookRows.map((row) => row.map((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value === null || value === undefined ? "" : String(value);
  })));
}

export function BulkLeaseImporter({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importedFileName, setImportedFileName] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
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
      if (mode === "commit") {
        if (autoActivate && payload.created_ids && payload.created_ids.length > 0) {
          try {
            await apiFetch("/property/leases/bulk-activate/", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
              body: JSON.stringify({ lease_ids: payload.created_ids }),
            }, session.activeOrganizationId);
          } catch {
            // non-fatal, fallback to draft
          }
        }
        onDone(); onClose(); setSourceRows([]); setPreview([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lease import could not be processed.");
    } finally { setBusy(false); }
  }

  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>Import existing leases</DialogTitle>
    {busy && <LinearProgress />}
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Match existing tenants and units. All imported leases for property onboarding are registered as existing paper leases — digital offer letter signing is bypassed.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Button variant="outlined" onClick={downloadTemplate}>Download CSV template</Button>
        <Button variant="contained" onClick={() => fileRef.current?.click()}>Choose CSV or Excel (.xlsx)</Button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          setError(""); setImportedFileName(""); setSourceRows([]); setPreview([]);
          try {
            const rows = await readImportFile(file);
            setSourceRows(rows);
            if (!rows.length) {
              setError("No lease rows were found. Ensure the first worksheet uses the template headings, including tenant_code and unit_code.");
            } else {
              setImportedFileName(file.name);
            }
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The selected file could not be read. Download the template and try again.");
          }
          event.target.value = "";
        }} />
        {sourceRows.length > 0 && <Button onClick={() => submit("preview")} disabled={busy}>Validate {sourceRows.length} rows</Button>}
      </Box>
      {importedFileName && <Alert severity="success" sx={{ mb: 2 }}>Loaded {sourceRows.length} lease row{sourceRows.length === 1 ? "" : "s"} from {importedFileName}. Validate before importing.</Alert>}
      {preview.length > 0 && <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Alert severity={validCount === preview.length ? "success" : "warning"}>
          {validCount} ready; {preview.length - validCount} need correction. Nothing has been saved yet.
        </Alert>
        <Table size="small"><TableHead><TableRow><TableCell>Row</TableCell><TableCell>Tenant</TableCell><TableCell>Unit</TableCell><TableCell>Term</TableCell><TableCell>Rent</TableCell><TableCell>Service Charge</TableCell><TableCell>Inherited deposit</TableCell><TableCell>Validation</TableCell></TableRow></TableHead>
          <TableBody>{preview.map((row) => <TableRow key={row.row} sx={Object.keys(row.errors).length ? { bgcolor: "error.lighter" } : undefined}>
            <TableCell>{row.row}</TableCell><TableCell>{row.data.tenant}</TableCell><TableCell>{row.data.unit_code}</TableCell>
            <TableCell>{row.data.starts_on} – {row.data.ends_on}</TableCell><TableCell>{row.data.monthly_rent}</TableCell>
            <TableCell>{row.data.service_charge ? `KES ${Number(row.data.service_charge).toLocaleString()}` : "—"}</TableCell>
            <TableCell>{row.data.deposit}</TableCell>
            <TableCell>{Object.values(row.errors).join(" ") || "Ready"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Paper>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          id="bulk-import-auto-activate"
          checked={autoActivate}
          onChange={(e) => setAutoActivate(e.target.checked)}
          style={{ marginRight: 8, width: 16, height: 16, accentColor: "var(--brand-primary, #1e40af)", cursor: "pointer" }}
        />
        <label htmlFor="bulk-import-auto-activate" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ⚡ Activate leases immediately upon import (populates live Tenancy Schedule & rent ledger)
        </label>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => submit("commit")} disabled={busy || !preview.length || validCount === 0} sx={{ fontWeight: 800 }}>
          Import {validCount} {autoActivate ? "Active" : "Draft"} Leases
        </Button>
      </Box>
    </DialogActions>
  </Dialog>;
}
